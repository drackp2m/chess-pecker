import {
	DestroyRef,
	Signal,
	WritableSignal,
	computed,
	effect,
	inject,
	signal,
	untracked,
} from '@angular/core';

import { slideOffset } from '@app/component/chess-board/board-geometry';
import { PieceSlide } from '@app/component/chess-piece/chess-piece.component';
import {
	BoardStage,
	BoardTransition,
	MoveAnimation,
	shouldAnimate,
} from '@app/definition/board-animation.type';
import { ChessPosition, Piece, PieceColor, Square } from '@app/definition/chess.type';
import {
	MoveSpeed,
	REPLAY_DELAY,
	SLIDE_DURATION,
	scaleForSpeed,
} from '@app/definition/move-speed.type';
import { SoundService } from '@app/service/sound.service';
import { ScheduledAction } from '@app/util/scheduled-action';

/** The slide a stage earned, and the square whose piece is to run it. */
export interface BoardSlide {
	readonly to: Square;
	readonly slide: PieceSlide;
	/** Drawn under the arriving piece, for as long as it has not arrived. */
	readonly taken: Piece | undefined;
}

export interface BoardPlaybackInput {
	readonly transition: Signal<BoardTransition | undefined>;
	readonly animation: Signal<MoveAnimation>;
	readonly orientation: Signal<PieceColor>;
	readonly speed: Signal<MoveSpeed>;
}

/** What the board is showing on account of the last thing it did. */
export interface BoardPlayback {
	/** Everything the beat on screen sends travelling, by the square it lands on. */
	readonly slides: Signal<readonly BoardSlide[]>;
	/** The board that beat runs over, or `undefined` for the one the state holds. */
	readonly board: Signal<ChessPosition | undefined>;
	/**
	 * Whether the beat on screen is still crossing. Everything that must wait for a move to
	 * land reads it: the piece being taken, the check lighting up, the board itself.
	 */
	readonly isSliding: Signal<boolean>;
	/**
	 * Whether the transition the state holds has been drawn all the way to its end. It goes
	 * false the instant a new one arrives, before any beat of it has run, so nothing can
	 * mistake the gap between a move being written and being drawn for a board at rest.
	 */
	readonly isSettled: Signal<boolean>;
}

/** What a beat needs to hand the board over to the one after it. */
interface PlaybackRun {
	readonly input: BoardPlaybackInput;
	readonly scheduled: ScheduledAction;
	/** Kept apart from the beats: a slide outlasts the beat that is holding them. */
	readonly settling: ScheduledAction;
	readonly beat: WritableSignal<number>;
	readonly sliding: WritableSignal<boolean>;
	/** The last transition drawn to its end, which is how a board at rest is recognised. */
	readonly drawn: WritableSignal<BoardTransition | undefined>;
	readonly sound: SoundService;
}

/**
 * Runs a transition beat by beat and voices each one, since a beat is a piece setting off,
 * which is exactly what a move sounds like.
 */
export function createBoardPlayback(input: BoardPlaybackInput): BoardPlayback {
	const run = createRun(input);
	const stage = computed(() => input.transition()?.stages[run.beat()]);

	// A transition arriving starts from its first beat, whatever the one it replaced reached.
	effect(() => {
		input.transition();

		// Only the transition is watched: the setting and the orientation are read untracked,
		// or turning the animation on would send a settled piece sailing in from its old square.
		untracked(() => {
			run.scheduled.cancel();
			run.beat.set(0);
			start(run);
		});
	});

	// Timers outlive the board they were started from, so they are stopped with it.
	inject(DestroyRef).onDestroy(() => {
		run.scheduled.cancel();
		run.settling.cancel();
	});

	return {
		slides: computed(() => describeSlides(input, stage())),
		board: computed(() => stage()?.board),
		isSliding: run.sliding.asReadonly(),
		isSettled: computed(() => input.transition() === run.drawn()),
	};
}

function createRun(input: BoardPlaybackInput): PlaybackRun {
	return {
		input,
		scheduled: new ScheduledAction(),
		settling: new ScheduledAction(),
		beat: signal(0),
		sliding: signal(false),
		drawn: signal<BoardTransition | undefined>(undefined),
		sound: inject(SoundService),
	};
}

/** Everything a beat does as it comes up: it is heard, it travels, and it hands over. */
function start(run: PlaybackRun): void {
	announce(run);
	hold(run);
	advance(run);
}

/**
 * Holds the beat open while its pieces are crossing. One with nothing to slide is over the
 * instant it is drawn, since it gives the rest of the board nothing to wait on.
 */
function hold(run: PlaybackRun): void {
	run.settling.cancel();

	if (!isTravelling(run)) {
		run.sliding.set(false);
		settle(run);

		return;
	}

	run.sliding.set(true);
	run.settling.run(
		() => {
			run.sliding.set(false);
			settle(run);
		},
		untracked(() => scaleForSpeed(SLIDE_DURATION, run.input.speed())),
	);
}

/**
 * Signs the transition off once its last beat is over. Nothing before that beat ends
 * anything: the pause in the middle of a castling is a board still on its way.
 */
function settle(run: PlaybackRun): void {
	untracked(() => {
		const transition = run.input.transition();

		if (run.beat() + 1 >= (transition?.stages.length ?? 0)) {
			run.drawn.set(transition);
		}
	});
}

function isTravelling(run: PlaybackRun): boolean {
	return untracked(() => {
		const transition = run.input.transition();
		const stage = transition?.stages[run.beat()];

		return (
			undefined !== transition &&
			undefined !== stage &&
			0 < stage.slides.length &&
			shouldAnimate(transition.kind, run.input.animation())
		);
	});
}

/** Hands the board over to the next beat, once this one has had its time. */
function advance(run: PlaybackRun): void {
	const stages = untracked(() => run.input.transition())?.stages ?? [];
	const next = untracked(() => run.beat()) + 1;

	if (next >= stages.length) {
		return;
	}

	run.scheduled.run(() => {
		run.beat.set(next);
		start(run);
	}, holdFor(run.input));
}

/**
 * The piece this beat sets off, heard as it goes: a move travelling two pieces sounds
 * twice, each clip on the beat that earns it. Which clip is the transition's business.
 */
function announce(run: PlaybackRun): void {
	const transition = untracked(() => run.input.transition());
	const sound = transition?.stages[untracked(() => run.beat())]?.sound;

	if (undefined !== transition && undefined !== sound) {
		run.sound.play(sound, 'backward' === transition.kind ? 'backward' : 'forward');
	}
}

/**
 * How long a beat stays up. One the setting silenced borrows the pause given to the
 * opponent's moves rather than flashing past.
 */
function holdFor(input: BoardPlaybackInput): number {
	return untracked(() => {
		const kind = input.transition()?.kind;
		const isSliding = undefined !== kind && shouldAnimate(kind, input.animation());

		return scaleForSpeed(isSliding ? SLIDE_DURATION : REPLAY_DELAY, input.speed());
	});
}

function describeSlides(
	input: BoardPlaybackInput,
	stage: BoardStage | undefined,
): readonly BoardSlide[] {
	const kind = input.transition()?.kind;

	if (undefined === stage || undefined === kind) {
		return [];
	}

	return untracked(() => {
		if (!shouldAnimate(kind, input.animation())) {
			return [];
		}

		const orientation = input.orientation();

		return stage.slides.map(({ from, to, taken }) => ({
			to,
			taken,
			slide: { ...slideOffset(from, to, orientation), key: stage.tick },
		}));
	});
}

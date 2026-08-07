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
import { ChessPosition, PieceColor, Square } from '@app/definition/chess.type';
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
}

/** What a beat needs to hand the board over to the one after it. */
interface PlaybackRun {
	readonly input: BoardPlaybackInput;
	readonly scheduled: ScheduledAction;
	readonly beat: WritableSignal<number>;
	readonly sound: SoundService;
}

/**
 * Runs a transition beat by beat, and voices each one: a beat is a piece setting off,
 * which is exactly what a move sounds like, so the clips are fired here rather than
 * where the move was played.
 *
 * Only the transition is watched. The setting and the orientation are read as each
 * beat starts, deliberately outside the reactive graph, because a board is redrawn
 * long after a move for all sorts of reasons and none of them may bring an old slide
 * back to life. Turning the animation on would otherwise send a piece that has been
 * sitting on its square since the last move sailing in from the one it left, and
 * flipping the board would replay that move backwards.
 *
 * The key is the tick alone: it already identifies the beat across the whole session,
 * and anything added to it — the drawing order of the square, say — would change under
 * a flip and be read as a slide the piece had not run yet.
 */
export function createBoardPlayback(input: BoardPlaybackInput): BoardPlayback {
	const scheduled = new ScheduledAction();
	/** Which beat of the transition is on screen. */
	const beat = signal(0);
	const stage = computed(() => input.transition()?.stages[beat()]);
	const run: PlaybackRun = { input, scheduled, beat, sound: inject(SoundService) };

	// A transition arriving always starts from its first beat, whatever the one it
	// replaced had reached — and one going away takes the beats it had left with it.
	effect(() => {
		input.transition();

		untracked(() => {
			scheduled.cancel();
			beat.set(0);
			announce(run);
			advance(run);
		});
	});

	// Timers outlive the board they were started from, so they are stopped with it.
	inject(DestroyRef).onDestroy(() => {
		scheduled.cancel();
	});

	return {
		slides: computed(() => describeSlides(input, stage())),
		board: computed(() => stage()?.board),
	};
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
		announce(run);
		advance(run);
	}, holdFor(run.input));
}

/**
 * The piece this beat sets off, heard as it goes. Every beat is voiced, which is why
 * the sound is fired from here and not from the store that played the move: a move
 * travelling two pieces sounds twice, each clip on the beat that earns it — the rook
 * going round before its king, the pawn stepping back before it is taken en passant.
 *
 * Which clip is the transition's own business; all this decides is when it is heard,
 * and that a rewind says it the other way round.
 */
function announce(run: PlaybackRun): void {
	const transition = untracked(() => run.input.transition());
	const sound = transition?.stages[untracked(() => run.beat())]?.sound;

	if (undefined !== transition && undefined !== sound) {
		run.sound.play(sound, 'backward' === transition.kind ? 'backward' : 'forward');
	}
}

/**
 * How long a beat stays up. A beat that slides lasts as long as the slide; one the
 * setting silenced is over the instant it is drawn, so it borrows the pause the
 * opponent's own moves are given rather than flashing past.
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

		return stage.slides.map(({ from, to }) => ({
			to,
			slide: { ...slideOffset(from, to, orientation), key: stage.tick },
		}));
	});
}

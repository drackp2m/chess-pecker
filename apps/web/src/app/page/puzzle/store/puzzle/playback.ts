import { DestroyRef, Signal, inject } from '@angular/core';
import {
	StateSignals,
	WritableStateSource,
	patchState,
	signalStoreFeature,
	type,
	withMethods,
} from '@ngrx/signals';

import { ChessMove, ChessPosition } from '@app/definition/chess.type';
import { MoveSpeed, scaleForSpeed } from '@app/definition/move-speed.type';
import { HINT_DELAY_MS, Puzzle, PuzzleOutcome } from '@app/definition/puzzle.type';
import { append } from '@app/page/puzzle/store/puzzle/record';
import {
	FreePlayAnchor,
	PuzzleStoreProps,
	commitPatch,
	describeOutcome,
} from '@app/page/puzzle/store/puzzle/session';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { ScheduledAction } from '@app/util/scheduled-action';
import { WatchedDelay } from '@app/util/watched-delay';

/**
 * How long a refuted move is left on the board before it is taken back for you. Like
 * every other beat of the playback, it is stretched or cut by the chosen move speed.
 */
const UNDO_DELAY = 800;

interface PuzzlePlaybackInput {
	/** The player's clock, which is the board's only one. */
	readonly boardClock: ScheduledAction;
	readonly puzzle: Signal<Puzzle | undefined>;
	readonly isReplaying: Signal<boolean>;
	readonly position: Signal<ChessPosition>;
	readonly positions: Signal<ChessPosition[]>;
	readonly freePlay: Signal<FreePlayAnchor | undefined>;
	readonly deviation: Signal<number | undefined>;
	readonly mistake: Signal<ChessMove | undefined>;
}

type PlaybackStore = StateSignals<PuzzleStoreProps> &
	WritableStateSource<PuzzleStoreProps> &
	PuzzlePlaybackInput;

interface PlaybackContext {
	readonly store: PlaybackStore;
	readonly scheduled: ScheduledAction;
	/** Kept apart from the board's own timer: nothing the player does may cut it short. */
	readonly hintGate: WatchedDelay;
	readonly speed: Signal<MoveSpeed>;
}

function outcomeAt(store: PlaybackStore, cursor: number): PuzzleOutcome {
	const puzzle = store.puzzle();

	// A replay in flight owns the outcome until it lands, and free play owns it for
	// as long as it is on.
	return undefined === puzzle || store.isReplaying() || undefined !== store.freePlay()
		? store.outcome()
		: describeOutcome(store.positions(), puzzle, store.deviation(), cursor);
}

/**
 * A move the player put on the board, which is the only kind there is any more. Everything
 * the board plays by itself is written before it is played — the opponent's answer by the
 * caller that starts the programme, the whole revealed line in one go — and a programme moves
 * nothing but the head. So anything reaching here is a move on its way into the log.
 */
function commit(store: PlaybackStore, move: ChessMove): void {
	// A move written into the log is the board moving on for real, so anything that was
	// holding it behind the line is spent: what it was waiting to show has now happened.
	patchState(store, commitPatch(store.position(), move), { rewound: 0 }, (state) =>
		append(state, { kind: 'move', move }),
	);
}

/**
 * Locks the hint and starts the clock that puts it on offer. Only opening an exercise
 * arms it: a restart is the same exercise being worked on, and the position has been
 * looked at for as long as it has been.
 */
function armHintGate(context: PlaybackContext): void {
	const { store, hintGate } = context;

	patchState(store, { hintUnlocked: false });

	hintGate.start(HINT_DELAY_MS, () => {
		patchState(store, { hintUnlocked: true });
	});
}

/**
 * Leaves the refuted move up long enough to be seen, then takes it back — unless there
 * is no longer a refuted move to take back. Opening an exploration is one of the ways
 * that happens: nothing in a sandbox is graded, so a take-back still pending when one is
 * opened is dropped rather than rewinding a line it has nothing to do with. The wrong
 * move is left standing on the main line for the player to step off.
 */
function scheduleUndo(context: PlaybackContext, undo: () => void): void {
	const { store, scheduled, speed } = context;

	scheduled.run(
		() => {
			if (undefined !== store.mistake()) {
				undo();
			}
		},
		scaleForSpeed(UNDO_DELAY, speed()),
	);
}

/**
 * Timers outlive the store they were started from, so they are stopped with it — the hint's
 * own, which is the only one made here. The take-back beats on the player's clock, and the
 * player is what stops that one.
 */
function createContext(store: PlaybackStore): PlaybackContext {
	const hintGate = new WatchedDelay();

	inject(DestroyRef).onDestroy(() => {
		hintGate.cancel();
	});

	return {
		store,
		scheduled: store.boardClock,
		hintGate,
		speed: inject(BoardPreferenceService).moveSpeed,
	};
}

/**
 * The clock the hint waits on: armed by the exercise opening, and told when the exercise
 * stopped being looked at and was picked up again. Nothing else on this board hears about
 * that — everything else here is an answer to something the player did, and none of it is
 * owed the time the tab spent in the background.
 */
function buildClockMethods(context: PlaybackContext) {
	return {
		armHintGate: (): void => {
			armHintGate(context);
		},

		pauseClock: (): void => {
			context.hintGate.pause();
		},

		resumeClock: (): void => {
			context.hintGate.resume();
		},
	};
}

function buildMethods(context: PlaybackContext) {
	const { store } = context;

	return {
		outcomeAt: (cursor: number): PuzzleOutcome => outcomeAt(store, cursor),

		commit: (move: ChessMove): void => {
			commit(store, move);
		},

		scheduleUndo: (undo: () => void): void => {
			scheduleUndo(context, undo);
		},

		...buildClockMethods(context),
	};
}

/**
 * What is left of the board playing by itself once the programmes took the replaying over:
 * the move the player puts on the board, the take-back a refuted one waits for, and the
 * clock the hint sits behind. The store decides *when* any of it happens; this decides how
 * it looks while it does.
 */
export function withPuzzlePlayback() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>(), props: type<PuzzlePlaybackInput>() },
		withMethods((store) => buildMethods(createContext(store))),
	);
}

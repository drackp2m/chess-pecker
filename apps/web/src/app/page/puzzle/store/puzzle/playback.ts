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

/** How long a refuted move stays up before the take-back. Scaled by the move speed. */
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

	// A replay in flight owns the outcome until it lands, and free play while it is on.
	return undefined === puzzle || store.isReplaying() || undefined !== store.freePlay()
		? store.outcome()
		: describeOutcome(store.positions(), puzzle, store.deviation(), cursor);
}

/**
 * A move the player put on the board, the only kind there is: everything the board plays by
 * itself is written before it is played, and a programme moves nothing but the head.
 */
function commit(store: PlaybackStore, move: ChessMove): void {
	// The board moving on for real spends whatever was holding it behind the line.
	patchState(store, commitPatch(store.position(), move), { rewound: 0 }, (state) =>
		append(state, { kind: 'move', move }),
	);
}

/**
 * Locks the hint and starts the clock. Only opening an exercise arms it: a restart is the
 * same exercise, and the position has been on screen for as long as it has.
 */
function armHintGate(context: PlaybackContext): void {
	const { store, hintGate } = context;

	patchState(store, { hintUnlocked: false });

	hintGate.start(HINT_DELAY_MS, () => {
		patchState(store, { hintUnlocked: true });
	});
}

/**
 * Leaves the refuted move up to be seen, then takes it back — unless there is none left.
 * Opening a free-play run drops a pending take-back: nothing in a sandbox is graded.
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
 * Timers outlive the store that started them, so the hint's is stopped with it. The
 * take-back beats on the player's clock, which the player stops.
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
 * The clock the hint waits on, told when the exercise stopped being looked at. Nothing else
 * here is owed the time the tab spent in the background.
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
 * What is left of the board playing by itself once programmes took over the replaying. The
 * store decides when any of it happens; this decides how it looks while it does.
 */
export function withPuzzlePlayback() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>(), props: type<PuzzlePlaybackInput>() },
		withMethods((store) => buildMethods(createContext(store))),
	);
}

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
import {
	ANNOUNCE_DELAY,
	MoveSpeed,
	REPLAY_DELAY,
	RESUME_DELAY,
	scaleForSpeed,
} from '@app/definition/move-speed.type';
import { Puzzle, PuzzleClosure, PuzzleOutcome, settleClosure } from '@app/definition/puzzle.type';
import { recordMove } from '@app/page/puzzle/store/puzzle/record';
import {
	PuzzleStoreProps,
	commitPatch,
	describeOutcome,
} from '@app/page/puzzle/store/puzzle/session';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { nextTransition } from '@app/util/chess/board-transition';
import { ChessNotation } from '@app/util/chess/chess-notation';
import { ScheduledAction } from '@app/util/scheduled-action';

/**
 * How long a refuted move is left on the board before it is taken back for you. Like
 * every other beat of the playback, it is stretched or cut by the chosen move speed.
 */
const UNDO_DELAY = 800;

interface PuzzlePlaybackInput {
	readonly puzzle: Signal<Puzzle | undefined>;
	readonly position: Signal<ChessPosition>;
	readonly deviation: Signal<number | undefined>;
	readonly mistake: Signal<ChessMove | undefined>;
}

type PlaybackStore = StateSignals<PuzzleStoreProps> &
	WritableStateSource<PuzzleStoreProps> &
	PuzzlePlaybackInput;

interface PlaybackContext {
	readonly store: PlaybackStore;
	readonly scheduled: ScheduledAction;
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
 * Whether the line that just landed ends the exercise. Only the main line played out
 * on the board does: free play is a sandbox, and an answer playing itself is the very
 * thing the player did not find.
 */
function landedClosure(
	store: PlaybackStore,
	outcome: PuzzleOutcome,
	wasRevealing: boolean,
): PuzzleClosure {
	const isFound = 'solved' === outcome && !wasRevealing && undefined === store.freePlay();

	return isFound ? settleClosure(store.closure(), 'found') : store.closure();
}

function commit(store: PlaybackStore, move: ChessMove, isOpponent: boolean): void {
	const position = store.position();

	patchState(
		store,
		(state) => commitPatch(state, position, move, isOpponent),
		(state) => recordMove(state, move),
	);
}

/**
 * Plays the scripted ply at the cursor in two beats: the piece lights up on
 * its own square first, so it can be seen before it slides across the board.
 */
function playScripted(context: PlaybackContext): void {
	const { store, scheduled, speed } = context;

	scheduled.cancel();
	patchState(store, { isReplaying: true });

	scheduled.run(
		() => {
			const expected = store.puzzle()?.moves[store.cursor()];
			const move =
				undefined === expected ? undefined : ChessNotation.parse(store.position(), expected);

			patchState(store, { announced: move });
			scheduled.run(
				() => {
					land(context, move);
				},
				scaleForSpeed(ANNOUNCE_DELAY, speed()),
			);
		},
		scaleForSpeed(REPLAY_DELAY, speed()),
	);
}

/**
 * A reveal walks the whole rest of the line, so it comes back here for the
 * next ply; a lone reply stops. Either way the line can run out early — a
 * mate cuts the script short, and from a finished position there is nothing
 * left to parse.
 */
function land(context: PlaybackContext, move: ChessMove | undefined): void {
	const { store } = context;

	patchState(store, { announced: undefined });

	if (undefined !== move) {
		commit(store, move, store.position().turn !== store.playerColor());
	}

	const isScriptLeft = store.cursor() < (store.puzzle()?.moves.length ?? 0);
	const wasRevealing = store.isRevealing();

	if (wasRevealing && undefined !== move && isScriptLeft) {
		playScripted(context);

		return;
	}

	// Real Lichess lines end on a player move, but a set that ends on the
	// opponent's would otherwise leave the exercise waiting forever.
	patchState(store, { isReplaying: false, isRevealing: false });

	const outcome = outcomeAt(store, store.cursor());

	patchState(store, { outcome, closure: landedClosure(store, outcome, wasRevealing) });
}

/**
 * Whether a board being come back to has anything of its own to replay. A playback still
 * in flight is about to paint it, and so is the take-back a refuted move is waiting for:
 * both are answers to something the player did, and neither may be cut short.
 */
function isSettled(store: PlaybackStore): boolean {
	return !store.isReplaying() && undefined === store.mistake();
}

/** The move a board picked up again replays, and the line it puts back once it has. */
interface ReplayBeat {
	readonly cursor: number;
	readonly move: ChessMove;
	readonly played: ChessPosition;
}

/** The piece that was named sets off, and the line is left exactly where it was found. */
function landReplay(store: PlaybackStore, beat: ReplayBeat): void {
	patchState(store, {
		cursor: beat.cursor,
		announced: undefined,
		isReplaying: false,
		transition: nextTransition(beat.played, beat.move, 'forward'),
	});
}

/**
 * Plays the last move of the visible line over again, for a board that is being come back
 * to rather than played on — the line as the cursor leaves it, never whatever the last
 * thing done to the board happened to be. A rewind is a way of looking at the line, not a
 * move in it, and looking at it is not something to be shown a second time.
 *
 * Nothing moved on the player's account here, so it is played the way the opponent's own
 * moves are: the position is left up long enough to be read, then the piece lights up on
 * the square it is about to leave, then it travels.
 *
 * Standing the line back on the board that move was played from is a beat of the
 * animation and nothing else — the cursor ends exactly where it was found, and the record
 * never hears about it.
 */
function replayLastMove(context: PlaybackContext): void {
	const { store, scheduled, speed } = context;
	const cursor = store.cursor();
	const move = store.line()[cursor - 1];
	const played = store.positions()[cursor - 1];

	// The beat the board was left standing on is dropped either way: it is over, and a
	// board coming back must not run it again on its way in.
	if (undefined === move || undefined === played || !isSettled(store)) {
		patchState(store, { transition: undefined });

		return;
	}

	// Stand the line back on the board the move was played from, so the piece that is
	// named is still on the square it is about to leave.
	scheduled.cancel();
	patchState(store, {
		cursor: cursor - 1,
		announced: undefined,
		transition: undefined,
		isReplaying: true,
	});

	scheduled.run(
		() => {
			patchState(store, { announced: move });
			scheduled.run(
				() => {
					landReplay(store, { cursor, move, played });
				},
				scaleForSpeed(ANNOUNCE_DELAY, speed()),
			);
		},
		scaleForSpeed(RESUME_DELAY, speed()),
	);
}

/** Leaves the refuted move up long enough to be seen, then takes it back. */
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

/** Timers outlive the store they were started from, so they are stopped with it. */
function createContext(store: PlaybackStore): PlaybackContext {
	const scheduled = new ScheduledAction();

	inject(DestroyRef).onDestroy(() => {
		scheduled.cancel();
	});

	return {
		store,
		scheduled,
		speed: inject(BoardPreferenceService).moveSpeed,
	};
}

function buildCoreMethods(context: PlaybackContext) {
	const { store } = context;

	return {
		outcomeAt: (cursor: number): PuzzleOutcome => outcomeAt(store, cursor),

		commit: (move: ChessMove, isOpponent: boolean): void => {
			commit(store, move, isOpponent);
		},

		playScripted: (): void => {
			playScripted(context);
		},

		replayLastMove: (): void => {
			replayLastMove(context);
		},
	};
}

function buildTimerMethods(context: PlaybackContext) {
	const { store, scheduled } = context;

	return {
		settleScripted: (): void => {
			if (store.isReplaying()) {
				scheduled.flush();
			}
		},

		cancelScripted: (): void => {
			if (store.isReplaying()) {
				scheduled.cancel();
			}
		},

		cancelPlayback: (): void => {
			scheduled.cancel();
		},

		scheduleUndo: (undo: () => void): void => {
			scheduleUndo(context, undo);
		},
	};
}

function buildMethods(context: PlaybackContext) {
	return {
		...buildCoreMethods(context),
		...buildTimerMethods(context),
	};
}

/**
 * Everything the board plays by itself, on a timer: the opponent's scripted replies,
 * the solution when it is asked for, the take-back of a refuted move, and the move the
 * line is standing on when an exercise is picked up again. The store decides *when* any
 * of it happens; this decides how it looks while it does.
 */
export function withPuzzlePlayback() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>(), props: type<PuzzlePlaybackInput>() },
		withMethods((store) => buildMethods(createContext(store))),
	);
}

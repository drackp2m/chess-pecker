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
import {
	HINT_DELAY_MS,
	Puzzle,
	PuzzleClosure,
	PuzzleMove,
	PuzzleOutcome,
	settleClosure,
} from '@app/definition/puzzle.type';
import { append } from '@app/page/puzzle/store/puzzle/record';
import { foldOrBlank } from '@app/page/puzzle/store/puzzle/replay';
import {
	FreePlayAnchor,
	PuzzleStoreProps,
	commitPatch,
	describeOutcome,
} from '@app/page/puzzle/store/puzzle/session';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { nextTransition } from '@app/util/chess/board-transition';
import { ChessNotation } from '@app/util/chess/chess-notation';
import { ScheduledAction } from '@app/util/scheduled-action';
import { WatchedDelay } from '@app/util/watched-delay';

/**
 * How long a refuted move is left on the board before it is taken back for you. Like
 * every other beat of the playback, it is stretched or cut by the chosen move speed.
 */
const UNDO_DELAY = 800;

interface PuzzlePlaybackInput {
	readonly puzzle: Signal<Puzzle | undefined>;
	readonly position: Signal<ChessPosition>;
	readonly positions: Signal<ChessPosition[]>;
	readonly line: Signal<PuzzleMove[]>;
	readonly cursor: Signal<number>;
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

/**
 * A move onto the board. It goes into the log while the exercise is open; once it is
 * closed the log takes nothing, and the answer playing itself out lands in `revealed`
 * instead — on the board, and deliberately not in the record of how it was solved.
 */
function commit(store: PlaybackStore, move: ChessMove): void {
	const position = store.position();

	// A move written into the log is the board moving on for real, so anything that was
	// holding it behind the line is spent: what it was waiting to show has now happened.
	// The answer played out after the close is folded from where the board is standing,
	// so there the offset is what keeps it there and it stays.
	if ('open' === store.closure()) {
		patchState(store, commitPatch(position, move), { rewound: 0 }, (state) =>
			append(state, { kind: 'move', move }),
		);

		return;
	}

	patchState(store, commitPatch(position, move), (state) => ({
		revealed: [...state.revealed, ChessNotation.describeLong(move)],
	}));
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
		commit(store, move);
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
 * Where the record alone leaves the cursor, with no answer played out on the end of it and
 * nothing held back. It is what the board falls to when a closed exercise is started over
 * and the reveal it was showing is dropped.
 */
function recordCursor(store: PlaybackStore): number {
	return foldOrBlank(store.fen(), store.record()).cursor;
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

/**
 * The piece that was named sets off, and the line is left exactly where it was found.
 * Landing means the board catches up with the log, which it does by writing the step it
 * still has to travel — or, on a record already closed, by letting go of that much of
 * what was being held back, since nothing there can be written.
 */
function landReplay(store: PlaybackStore, beat: ReplayBeat): void {
	const landed = {
		announced: undefined,
		isReplaying: false,
		transition: nextTransition(beat.played, beat.move, 'forward'),
	};

	if ('open' === store.closure()) {
		// `cursor` is the log's own less whatever is held back, so putting them together
		// again says where the log itself is standing.
		const step = beat.cursor - (store.cursor() + store.rewound());

		patchState(store, (state) => append(state, { kind: 'step', step }), {
			...landed,
			rewound: 0,
		});
	} else {
		// The board catches up by giving back exactly the plies it travels, so the offset
		// shrinks by the distance rather than being worked out from the cursor it moved.
		patchState(store, (state) => ({
			...landed,
			rewound: Math.max(0, state.rewound - (beat.cursor - store.cursor())),
		}));
	}

	patchState(store, { outcome: outcomeAt(store, beat.cursor) });
}

/**
 * A move the line already holds, shown again: the position is left up long enough to be
 * read, then the piece lights up on the square it is about to leave, then it travels.
 * Nothing is committed and nothing is recorded — the move happened once already.
 */
function replayBeat(context: PlaybackContext, beat: ReplayBeat): void {
	const { store, scheduled, speed } = context;

	patchState(store, { isReplaying: true });

	scheduled.run(
		() => {
			patchState(store, { announced: beat.move });
			scheduled.run(
				() => {
					landReplay(store, beat);
				},
				scaleForSpeed(ANNOUNCE_DELAY, speed()),
			);
		},
		scaleForSpeed(RESUME_DELAY, speed()),
	);
}

/**
 * The restart button. It takes the board back to the position the exercise opened on
 * and replays the opponent's first move onto it, and that is all it does: the line is
 * left standing to its full length, so everything that was solved is still there to be
 * stepped back up to. Nothing may be played until the cursor gets there.
 *
 * A line with no opening move in it yet is one the exercise has not begun on, so there
 * the first move is played for real instead of shown again.
 *
 * The log's own `0` already stands the board on the opening move, which is where the
 * rewind is going and not where it starts. It is held one ply behind that while the move
 * is shown again, so the board really is the one the exercise opened on until it travels.
 */
function rewindToStart(context: PlaybackContext): void {
	const { store, scheduled } = context;
	const move = store.line()[0];
	const played = store.positions()[0];

	scheduled.cancel();
	patchState(store, (state) => ({
		// The board sits on ply 0 for the whole rewind, whether the opening move is about
		// to be shown again from there or played for the first time. While the record is
		// open its own `0` has already carried the log to ply 1, so one ply is held back.
		//
		// A closed record took no restart at all, so the board is stood back by hand — and
		// the answer it had played out is dropped in the same breath, because starting the
		// exercise over is starting it over. What is left to hold back is the log's own
		// cursor, which is where the fold would otherwise leave the board.
		...('open' === state.closure ? { rewound: 1 } : { rewound: recordCursor(store), revealed: [] }),
		announced: undefined,
		selected: undefined,
		pendingPromotion: undefined,
		transition: undefined,
		isRevealing: false,
	}));

	if (undefined === move || undefined === played) {
		playScripted(context);

		return;
	}

	replayBeat(context, { cursor: 1, move, played });
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
	const { store, scheduled } = context;
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
	// named is still on the square it is about to leave. It is a beat of the animation and
	// nothing that happened, so it is held apart from the log: `rewound` is display only,
	// and `landReplay` drops it once the piece has travelled.
	scheduled.cancel();
	patchState(store, { rewound: 1, announced: undefined, transition: undefined });

	replayBeat(context, { cursor, move, played });
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

/** Timers outlive the store they were started from, so they are stopped with it. */
function createContext(store: PlaybackStore): PlaybackContext {
	const scheduled = new ScheduledAction();
	const hintGate = new WatchedDelay();

	inject(DestroyRef).onDestroy(() => {
		scheduled.cancel();
		hintGate.cancel();
	});

	return {
		store,
		scheduled,
		hintGate,
		speed: inject(BoardPreferenceService).moveSpeed,
	};
}

function buildCoreMethods(context: PlaybackContext) {
	const { store } = context;

	return {
		outcomeAt: (cursor: number): PuzzleOutcome => outcomeAt(store, cursor),

		commit: (move: ChessMove): void => {
			commit(store, move);
		},

		playScripted: (): void => {
			playScripted(context);
		},

		replayLastMove: (): void => {
			replayLastMove(context);
		},

		rewindToStart: (): void => {
			rewindToStart(context);
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
	return {
		...buildCoreMethods(context),
		...buildTimerMethods(context),
		...buildClockMethods(context),
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

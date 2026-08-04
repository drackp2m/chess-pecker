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
	scaleForSpeed,
} from '@app/definition/move-speed.type';
import { Puzzle, PuzzleOutcome } from '@app/definition/puzzle.type';
import {
	PuzzleStoreProps,
	commitPatch,
	describeOutcome,
} from '@app/page/puzzle/store/puzzle/session';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { SoundService } from '@app/service/sound.service';
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
	readonly sound: SoundService;
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

function commit(
	store: PlaybackStore,
	sound: SoundService,
	move: ChessMove,
	isOpponent: boolean,
): void {
	const position = store.position();

	patchState(store, (state) => commitPatch(state, position, move, isOpponent));

	// Read after the patch, so it is the position the move produced that is judged.
	sound.playMove(store.position(), move);
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
	const { store, sound } = context;

	patchState(store, { announced: undefined });

	if (undefined !== move) {
		commit(store, sound, move, store.position().turn !== store.playerColor());
	}

	const isScriptLeft = store.cursor() < (store.puzzle()?.moves.length ?? 0);

	if (store.isRevealing() && undefined !== move && isScriptLeft) {
		playScripted(context);

		return;
	}

	// Real Lichess lines end on a player move, but a set that ends on the
	// opponent's would otherwise leave the exercise waiting forever.
	patchState(store, { isReplaying: false, isRevealing: false });
	patchState(store, { outcome: outcomeAt(store, store.cursor()) });
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
		sound: inject(SoundService),
		speed: inject(BoardPreferenceService).moveSpeed,
	};
}

function buildMethods(context: PlaybackContext) {
	const { store, sound, scheduled } = context;

	return {
		outcomeAt: (cursor: number): PuzzleOutcome => outcomeAt(store, cursor),

		commit: (move: ChessMove, isOpponent: boolean): void => {
			commit(store, sound, move, isOpponent);
		},

		playScripted: (): void => {
			playScripted(context);
		},

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
 * Everything the board plays by itself, on a timer: the opponent's scripted replies,
 * the solution when it is asked for, and the take-back of a refuted move. The store
 * decides *when* any of it happens; this decides how it looks while it does.
 */
export function withPuzzlePlayback() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>(), props: type<PuzzlePlaybackInput>() },
		withMethods((store) => buildMethods(createContext(store))),
	);
}

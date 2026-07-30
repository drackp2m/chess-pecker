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
import { Puzzle, PuzzleOutcome } from '@app/definition/puzzle.type';
import {
	PuzzleStoreProps,
	commitPatch,
	describeOutcome,
} from '@app/page/puzzle/store/puzzle-session';
import { ChessNotation } from '@app/util/chess/chess-notation';
import { ScheduledAction } from '@app/util/scheduled-action';

/** Pause before the piece lights up. */
const REPLAY_DELAY = 300;
/** How long it stays lit before it slides to its destination. */
const ANNOUNCE_DELAY = 450;
/** How long a refuted move is left on the board before it is taken back for you. */
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

function outcomeAt(store: PlaybackStore, cursor: number): PuzzleOutcome {
	const puzzle = store.puzzle();

	// A replay in flight owns the outcome until it lands.
	return undefined === puzzle || store.isReplaying()
		? store.outcome()
		: describeOutcome(store.positions(), puzzle, store.deviation(), cursor);
}

function commit(store: PlaybackStore, move: ChessMove, isOpponent: boolean): void {
	const position = store.position();

	patchState(store, (state) => commitPatch(state, position, move, isOpponent));
}

/**
 * Plays the scripted ply at the cursor in two beats: the piece lights up on
 * its own square first, so it can be seen before it slides across the board.
 */
function playScripted(store: PlaybackStore, scheduled: ScheduledAction): void {
	scheduled.cancel();
	patchState(store, { isReplaying: true });

	scheduled.run(() => {
		const expected = store.puzzle()?.moves[store.cursor()];
		const move =
			undefined === expected ? undefined : ChessNotation.parse(store.position(), expected);

		patchState(store, { announced: move });
		scheduled.run(() => {
			land(store, scheduled, move);
		}, ANNOUNCE_DELAY);
	}, REPLAY_DELAY);
}

/**
 * A reveal walks the whole rest of the line, so it comes back here for the
 * next ply; a lone reply stops. Either way the line can run out early — a
 * mate cuts the script short, and from a finished position there is nothing
 * left to parse.
 */
function land(store: PlaybackStore, scheduled: ScheduledAction, move: ChessMove | undefined): void {
	patchState(store, { announced: undefined });

	if (undefined !== move) {
		commit(store, move, store.position().turn !== store.playerColor());
	}

	const isScriptLeft = store.cursor() < (store.puzzle()?.moves.length ?? 0);

	if (store.isRevealing() && undefined !== move && isScriptLeft) {
		playScripted(store, scheduled);

		return;
	}

	// Real Lichess lines end on a player move, but a set that ends on the
	// opponent's would otherwise leave the exercise waiting forever.
	patchState(store, { isReplaying: false, isRevealing: false });
	patchState(store, { outcome: outcomeAt(store, store.cursor()) });
}

/**
 * Everything the board plays by itself, on a timer: the opponent's scripted replies,
 * the solution when it is asked for, and the take-back of a refuted move. The store
 * decides *when* any of it happens; this decides how it looks while it does.
 */
export function withPuzzlePlayback() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>(), props: type<PuzzlePlaybackInput>() },
		withMethods((store) => {
			const scheduled = new ScheduledAction();

			inject(DestroyRef).onDestroy(() => {
				scheduled.cancel();
			});

			return {
				outcomeAt: (cursor: number): PuzzleOutcome => outcomeAt(store, cursor),

				commit: (move: ChessMove, isOpponent: boolean): void => {
					commit(store, move, isOpponent);
				},

				playScripted: (): void => {
					playScripted(store, scheduled);
				},

				cancelPlayback(): void {
					scheduled.cancel();
				},

				/** Leaves the refuted move up long enough to be seen, then takes it back. */
				scheduleUndo(undo: () => void): void {
					scheduled.run(() => {
						if (undefined !== store.mistake()) {
							undo();
						}
					}, UNDO_DELAY);
				},
			};
		}),
	);
}

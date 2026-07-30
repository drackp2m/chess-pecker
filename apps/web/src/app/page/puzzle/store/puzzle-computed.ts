import { Signal, computed, inject } from '@angular/core';
import { signalStoreFeature, type, withComputed } from '@ngrx/signals';

import { ChessMove, ChessPosition, PieceColor, Square } from '@app/definition/chess.type';
import { Puzzle, PuzzleMove } from '@app/definition/puzzle.type';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library.store';
import {
	PuzzleStoreProps,
	describeProgress,
	findDeviation,
	isPastDeviation,
	mistakeAt,
} from '@app/page/puzzle/store/puzzle-session';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';

interface SessionInput {
	readonly announced: Signal<ChessMove | undefined>;
	readonly isReplaying: Signal<boolean>;
	readonly cursor: Signal<number>;
	readonly playerColor: Signal<PieceColor>;
}

/** What the board offers from the position on screen, script aside. */
function boardComputed(position: Signal<ChessPosition>, selected: Signal<Square | undefined>) {
	return {
		legalMoves: computed(() => ChessMoveGenerator.legalMoves(position())),

		// ToDo => generates the moves a second time instead of reusing the
		// `legalMoves` computed declared just above, so every click re-runs the
		// generator for a list that is already memoised. `MatchStore` gets this
		// right (`this.legalMoves().filter(...)`); the only reason it cannot be
		// written the same way here is that `legalMoves` is being defined in the
		// same object literal — hoisting it next to `position` fixes both.
		movesFromSelection: computed(() => {
			const current = selected();

			return undefined === current
				? []
				: ChessMoveGenerator.legalMoves(position()).filter((move) => current === move.from);
		}),

		checkedSquare: computed<Square | undefined>(() => ChessMoveGenerator.checkedSquare(position())),
	};
}

/** The scoresheet: what has been played, and where in it the cursor is standing. */
function lineComputed(
	line: Signal<PuzzleMove[]>,
	cursor: Signal<number>,
	deviation: Signal<number | undefined>,
) {
	return {
		/** Only the moves up to the cursor, so stepping back shortens the scoresheet. */
		history: computed(() => line().slice(0, cursor())),

		lastMove: computed<ChessMove | undefined>(() => line()[cursor() - 1]),

		mistake: computed<ChessMove | undefined>(() => mistakeAt(line(), cursor(), deviation())),

		canStepBackward: computed(() => 0 < cursor()),
		canStepForward: computed(() => cursor() < line().length),
	};
}

/** How the exercise is going: what is being replayed, and how far along the script it is. */
function sessionComputed(
	puzzle: Signal<Puzzle | undefined>,
	store: SessionInput,
	deviation: Signal<number | undefined>,
) {
	return {
		announcedMove: computed(() => store.announced()),

		isBusy: computed(() => store.isReplaying()),

		progress: computed(() =>
			describeProgress(store.cursor(), puzzle(), store.playerColor(), deviation()),
		),
	};
}

/**
 * Everything the puzzle store derives rather than stores. Split off as a signal
 * store feature so the store class itself is left holding only commands.
 */
export function withPuzzleComputed() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>() },
		withComputed((store) => {
			const puzzle = inject(PuzzleLibraryStore).current;

			const position = computed(() => store.positions()[store.cursor()] ?? ChessFen.initial());

			// ToDo => `findDeviation` rescans the whole line on every cursor change, and
			// each ply costs an `isSolution` — a full `legalMoves` to parse the scripted
			// move, plus a second one via `status()` whenever the first check fails. It
			// also depends on `cursor`, which it never reads, so stepping through a line
			// re-derives a value that cannot have changed. Dropping `cursor` from the
			// input (it belongs to `isPastDeviation`, which already takes it separately)
			// makes this recompute only when a move is actually played.
			const deviation = computed(() =>
				findDeviation(
					{ positions: store.positions(), line: store.line(), cursor: store.cursor() },
					puzzle(),
				),
			);

			/** Past the deviation the script no longer applies, so both sides are yours. */
			const isFreePlay = computed(() => isPastDeviation(deviation(), store.cursor()));

			const isPlayerTurn = computed(
				() => 'solving' === store.outcome() && position().turn === store.playerColor(),
			);

			return {
				puzzle,
				position,
				deviation,
				isFreePlay,
				isPlayerTurn,

				...boardComputed(position, store.selected),
				...lineComputed(store.line, store.cursor, deviation),
				...sessionComputed(puzzle, store, deviation),
			};
		}),
	);
}

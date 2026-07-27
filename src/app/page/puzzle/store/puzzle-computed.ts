import { computed, inject } from '@angular/core';
import { signalStoreFeature, type, withComputed } from '@ngrx/signals';

import { ChessMove, Square } from '@app/definition/chess.type';
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

			const canPlay = computed(() => !store.isReplaying() && (isPlayerTurn() || isFreePlay()));

			return {
				puzzle,
				position,
				deviation,
				isFreePlay,
				isPlayerTurn,
				canPlay,

				legalMoves: computed(() => ChessMoveGenerator.legalMoves(position())),

				movesFromSelection: computed(() => {
					const selected = store.selected();

					return undefined === selected
						? []
						: ChessMoveGenerator.legalMoves(position()).filter((move) => selected === move.from);
				}),

				/** Only the moves up to the cursor, so stepping back shortens the scoresheet. */
				history: computed(() => store.line().slice(0, store.cursor())),

				lastMove: computed<ChessMove | undefined>(() => store.line()[store.cursor() - 1]),

				mistake: computed<ChessMove | undefined>(() =>
					mistakeAt(store.line(), store.cursor(), deviation()),
				),

				announcedMove: computed(() => store.announced()),

				checkedSquare: computed<Square | undefined>(() =>
					ChessMoveGenerator.checkedSquare(position()),
				),

				isBusy: computed(() => store.isReplaying()),
				isLocked: computed(() => undefined === puzzle() || !canPlay()),

				canStepBackward: computed(() => 0 < store.cursor()),
				canStepForward: computed(() => store.cursor() < store.line().length),

				progress: computed(() =>
					describeProgress(store.cursor(), puzzle(), store.playerColor(), deviation()),
				),
			};
		}),
	);
}

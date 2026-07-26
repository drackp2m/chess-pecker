import { computed, inject } from '@angular/core';
import { signalStoreFeature, type, withComputed } from '@ngrx/signals';

import { ChessMove, Square } from '@app/definition/chess.type';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library.store';
import { PuzzleStoreProps, describeProgress } from '@app/page/puzzle/store/puzzle-session';
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

			/** A refuted attempt is shown in place of the position it was played from. */
			const position = computed(
				() => store.attempt()?.position ?? store.positions()[store.cursor()] ?? ChessFen.initial(),
			);

			const isPlayerTurn = computed(
				() =>
					'solving' === store.outcome() &&
					undefined === store.attempt() &&
					position().turn === store.playerColor(),
			);

			return {
				puzzle,
				position,
				isPlayerTurn,

				legalMoves: computed(() => ChessMoveGenerator.legalMoves(position())),

				movesFromSelection: computed(() => {
					const selected = store.selected();

					if (undefined === selected) {
						return [];
					}

					return ChessMoveGenerator.legalMoves(position()).filter((move) => selected === move.from);
				}),

				/** Only the moves up to the cursor, so stepping back shortens the scoresheet. */
				history: computed(() => store.line().slice(0, store.cursor())),

				lastMove: computed<ChessMove | undefined>(
					() => store.attempt()?.move ?? store.line()[store.cursor() - 1],
				),

				mistake: computed<ChessMove | undefined>(() => store.attempt()?.move),

				checkedSquare: computed<Square | undefined>(() =>
					ChessMoveGenerator.checkedSquare(position()),
				),

				isBusy: computed(() => store.isReplaying()),
				isLocked: computed(() => undefined === puzzle() || !isPlayerTurn()),

				canStepBackward: computed(() => undefined !== store.attempt() || 0 < store.cursor()),
				canStepForward: computed(
					() => undefined === store.attempt() && store.cursor() < store.line().length,
				),

				progress: computed(() => describeProgress(store.cursor(), puzzle(), store.playerColor())),
			};
		}),
	);
}

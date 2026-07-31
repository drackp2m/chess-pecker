import { Signal, computed } from '@angular/core';
import { signalStoreFeature, type, withComputed } from '@ngrx/signals';

import { Puzzle } from '@app/definition/puzzle.type';
import { PuzzleStoreProps } from '@app/page/puzzle/store/puzzle-session';

interface PuzzleGatingInput {
	readonly puzzle: Signal<Puzzle | undefined>;
	readonly isFreePlay: Signal<boolean>;
	readonly isOffScript: Signal<boolean>;
	readonly isPlayerTurn: Signal<boolean>;
}

/**
 * What the board still accepts. Nothing here is a preference any more: a miss can
 * always be tried again, off the script both sides are yours, and the answer is
 * yours to ask for the moment the exercise has been failed — but not before, and
 * only once, because seeing it is the reward for having tried.
 */
export function withPuzzleGating() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>(), props: type<PuzzleGatingInput>() },
		withComputed((store) => {
			/** The miss is graded, so anything played from here on is only practice. */
			const isPractice = computed(() => 'failed' === store.result());

			const canPlay = computed(() => {
				if (store.isReplaying()) {
					return false;
				}

				return store.isFreePlay() || store.isOffScript() || store.isPlayerTurn();
			});

			return {
				isPractice,
				canPlay,

				canRevealSolution: computed(
					() =>
						undefined !== store.puzzle() &&
						isPractice() &&
						!store.isRevealed() &&
						!store.isReplaying() &&
						!store.isFreePlay(),
				),

				isLocked: computed(() => undefined === store.puzzle() || !canPlay()),
			};
		}),
	);
}

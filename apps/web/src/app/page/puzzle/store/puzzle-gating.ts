import { Signal, computed, inject } from '@angular/core';
import { signalStoreFeature, type, withComputed } from '@ngrx/signals';

import { Puzzle } from '@app/definition/puzzle.type';
import { PuzzleStoreProps } from '@app/page/puzzle/store/puzzle-session';
import { MistakePolicyService } from '@app/service/mistake-policy.service';

interface PuzzleGatingInput {
	readonly puzzle: Signal<Puzzle | undefined>;
	readonly isFreePlay: Signal<boolean>;
	readonly isPlayerTurn: Signal<boolean>;
}

/**
 * What the board still accepts, which after a miss is a matter of preference rather
 * than of chess: the verdict is already settled, so playing on, retrying and seeing
 * the solution are each there only if they were asked for.
 */
export function withPuzzleGating() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>(), props: type<PuzzleGatingInput>() },
		withComputed((store) => {
			const policy = inject(MistakePolicyService).policy;

			/** The miss is graded, so anything played from here on is only practice. */
			const isPractice = computed(() => 'failed' === store.result());

			const canPlay = computed(() => {
				if (store.isReplaying()) {
					return false;
				}

				return store.isFreePlay()
					? policy().freePlay
					: store.isPlayerTurn() && (!isPractice() || policy().retry);
			});

			/** Whether the button is there at all; pressing it is `canRevealSolution`. */
			const isSolutionOffered = computed(
				() => policy().showSolution && undefined !== store.puzzle(),
			);

			return {
				isPractice,
				canPlay,
				isSolutionOffered,

				canRevealSolution: computed(
					() =>
						isSolutionOffered() &&
						!store.isReplaying() &&
						'idle' !== store.outcome() &&
						'solved' !== store.outcome(),
				),

				isLocked: computed(() => undefined === store.puzzle() || !canPlay()),
			};
		}),
	);
}

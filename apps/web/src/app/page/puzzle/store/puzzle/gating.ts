import { Signal, computed } from '@angular/core';
import { StateSignals, signalStoreFeature, type, withComputed } from '@ngrx/signals';

import { Puzzle } from '@app/definition/puzzle.type';
import { PuzzleStoreProps } from '@app/page/puzzle/store/puzzle/session';

interface PuzzleGatingInput {
	readonly puzzle: Signal<Puzzle | undefined>;
	readonly isFreePlay: Signal<boolean>;
	readonly isOffScript: Signal<boolean>;
	readonly isPlayerTurn: Signal<boolean>;
}

type GatingStore = StateSignals<PuzzleStoreProps> & PuzzleGatingInput;

/** The hint: whether it is still there to be taken, and what taking it uncovers. */
function hintComputed(store: GatingStore, isOpen: Signal<boolean>) {
	return {
		canUseHint: computed(() => undefined !== store.puzzle() && isOpen() && !store.hintUsed()),

		/** The themes are the hint, and the exercise ending hands them over anyway. */
		areThemesShown: computed(() => store.hintUsed() || !isOpen()),
	};
}

/**
 * Giving up is asking for the answer, so it takes a miss to have earned it, and it is
 * offered only while the exercise is open — playing it out is what ends it.
 */
function canGiveUp(store: GatingStore, isOpen: boolean): boolean {
	return (
		undefined !== store.puzzle() &&
		isOpen &&
		0 < store.mistakeCount() &&
		!store.isReplaying() &&
		!store.isFreePlay()
	);
}

/**
 * What the board still accepts. Nothing here is a preference any more: a miss can
 * always be tried again, off the script both sides are yours, the themes are yours to
 * ask for, and so is the answer once the exercise has been missed.
 */
export function withPuzzleGating() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>(), props: type<PuzzleGatingInput>() },
		withComputed((store) => {
			/** The miss is graded, so anything played from here on is only practice. */
			const isPractice = computed(() => 'failed' === store.result());

			/** The exercise is still going, however it has been graded. */
			const isOpen = computed(() => 'open' === store.closure());

			const canPlay = computed(() => {
				if (store.isReplaying()) {
					return false;
				}

				return store.isFreePlay() || store.isOffScript() || store.isPlayerTurn();
			});

			return {
				isPractice,
				isOpen,
				canPlay,

				...hintComputed(store, isOpen),

				canRevealSolution: computed(() => canGiveUp(store, isOpen())),

				isLocked: computed(() => undefined === store.puzzle() || !canPlay()),
			};
		}),
	);
}

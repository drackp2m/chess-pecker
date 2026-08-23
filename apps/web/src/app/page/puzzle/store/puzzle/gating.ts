import { Signal, computed } from '@angular/core';
import { StateSignals, signalStoreFeature, type, withComputed } from '@ngrx/signals';

import { Puzzle } from '@app/definition/puzzle.type';
import { PuzzleStoreProps } from '@app/page/puzzle/store/puzzle/session';

interface PuzzleGatingInput {
	readonly puzzle: Signal<Puzzle | undefined>;
	readonly isReplaying: Signal<boolean>;
	readonly isFreePlay: Signal<boolean>;
	readonly isBehindLine: Signal<boolean>;
	readonly isPlayerTurn: Signal<boolean>;
}

type GatingStore = StateSignals<PuzzleStoreProps> & PuzzleGatingInput;

/**
 * The hint: whether it can still be taken, and what it uncovers. Not on offer until the
 * exercise has been looked at for `HINT_DELAY_MS`.
 */
function hintComputed(store: GatingStore, isOpen: Signal<boolean>) {
	return {
		canUseHint: computed(
			() => undefined !== store.puzzle() && isOpen() && !store.hintUsed() && store.hintUnlocked(),
		),

		/** The themes are the hint, and the exercise ending hands them over anyway. */
		areThemesShown: computed(() => store.hintUsed() || !isOpen()),
	};
}

/**
 * Giving up takes a miss to have earned it, and stays on offer once earned: the first ask
 * closes the exercise, and the rest only replay the line.
 */
function canGiveUp(store: GatingStore): boolean {
	return (
		undefined !== store.puzzle() &&
		0 < store.mistakeCount() &&
		!store.isReplaying() &&
		!store.isFreePlay()
	);
}

/**
 * What the board still accepts. It refuses two things: a move into the middle of the line,
 * and one from a refuted position. Free play allows both, and is entered on purpose.
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

				if (store.isFreePlay()) {
					return true;
				}

				return !store.isBehindLine() && store.isPlayerTurn();
			});

			return {
				isPractice,
				isOpen,
				canPlay,

				...hintComputed(store, isOpen),

				canRevealSolution: computed(() => canGiveUp(store)),

				isLocked: computed(() => undefined === store.puzzle() || !canPlay()),
			};
		}),
	);
}

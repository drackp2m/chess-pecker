import { Component, computed, inject } from '@angular/core';

import { PuzzleDifficulty } from '@app/definition/puzzle.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { puzzleDifficulty } from '@app/util/puzzle-difficulty';

/** Reads at a glance as wifi-style bars, from the open puzzle's rating. */
@Component({
	selector: 'app-puzzle-difficulty',
	templateUrl: './puzzle-difficulty.component.html',
	styleUrl: './puzzle-difficulty.component.scss',
})
export class PuzzleDifficultyComponent {
	readonly bars = [1, 2, 3] as const;

	private readonly store = inject(PuzzleStore);

	readonly difficulty = computed<PuzzleDifficulty | undefined>(() => {
		const puzzle = this.store.puzzle();

		return undefined === puzzle ? undefined : puzzleDifficulty(puzzle.rating);
	});

	readonly level = computed(() => {
		switch (this.difficulty()) {
			case 'easy':
				return 1;
			case 'medium':
				return 2;
			case 'hard':
				return 3;
			default:
				return 0;
		}
	});
}

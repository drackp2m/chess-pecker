import { Component, computed, inject } from '@angular/core';

import { PuzzleDifficulty } from '@app/definition/puzzle.type';
import { I18n } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { I18nService } from '@app/service/i18n.service';
import { puzzleDifficulty } from '@app/util/puzzle-difficulty';

const DIFFICULTY_KEY = {
	easy: I18n.common.DIFFICULTY_EASY,
	medium: I18n.common.DIFFICULTY_MEDIUM,
	hard: I18n.common.DIFFICULTY_HARD,
} as const satisfies Record<PuzzleDifficulty, string>;

/** Reads at a glance as wifi-style bars, from the open puzzle's rating. */
@Component({
	selector: 'app-puzzle-difficulty',
	templateUrl: './puzzle-difficulty.component.html',
	styleUrl: './puzzle-difficulty.component.scss',
})
export class PuzzleDifficultyComponent {
	readonly bars = [1, 2, 3] as const;

	private readonly store = inject(PuzzleStore);
	private readonly i18n = inject(I18nService);

	readonly difficulty = computed<PuzzleDifficulty | undefined>(() => {
		const puzzle = this.store.puzzle();

		return undefined === puzzle ? undefined : puzzleDifficulty(puzzle.rating);
	});

	readonly label = computed(() => {
		const difficulty = this.difficulty();

		return undefined === difficulty
			? ''
			: this.i18n.translate(I18n.common.DIFFICULTY, {
					level: this.i18n.translate(DIFFICULTY_KEY[difficulty]),
				});
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

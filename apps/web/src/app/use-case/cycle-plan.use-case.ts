import { Injectable, inject } from '@angular/core';
import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';

import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import {
	TrainingCycleRow,
	TrainingPuzzleRow,
} from '@app/repository/definition/training-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { PreviousAttempt, difficultyScore, median } from '@app/util/cycle-difficulty';
import { CycleCandidate, buildCycleOrder } from '@app/util/cycle-order';
import { puzzleStructure } from '@app/util/puzzle-structure';

interface PersonalHistory {
	readonly bookmarks: ReadonlyMap<string, PuzzleBookmarkType>;
	readonly attempts: ReadonlyMap<string, PreviousAttempt>;
	readonly medianMs: number | undefined;
}

@Injectable({
	providedIn: 'root',
})
export class CyclePlanUseCase {
	private readonly repository = inject(TrainingLocalRepository);

	async order(
		set: readonly TrainingPuzzleRow[],
		previous: TrainingCycleRow | undefined,
	): Promise<TrainingPuzzleRow[]> {
		const rows = await this.repository.findPuzzles(set.map((entry) => entry.lichessId));
		const puzzles = new Map(rows.map((row) => [row.lichessId, row]));
		const history = await this.history(previous);

		return buildCycleOrder(
			set.map((entry) => this.toCandidate(entry, puzzles.get(entry.lichessId), history)),
		);
	}

	private toCandidate(
		entry: TrainingPuzzleRow,
		puzzle: PuzzleRow | undefined,
		history: PersonalHistory,
	): CycleCandidate<TrainingPuzzleRow> {
		return {
			item: entry,
			themes: puzzle?.themes ?? [],
			score: difficultyScore({
				rating: entry.rating,
				structure: puzzleStructure(puzzle),
				bookmark: history.bookmarks.get(entry.lichessId),
				attempt: history.attempts.get(entry.lichessId),
				medianMs: history.medianMs,
			}),
		};
	}

	private async history(previous: TrainingCycleRow | undefined): Promise<PersonalHistory> {
		const attempts = await this.previousAttempts(previous);

		return {
			bookmarks: await this.bookmarks(),
			attempts,
			medianMs: median([...attempts.values()].map((attempt) => attempt.durationMs)),
		};
	}

	private async bookmarks(): Promise<ReadonlyMap<string, PuzzleBookmarkType>> {
		const rows = await this.repository.findAll('bookmark');

		return new Map(
			rows.filter((row) => undefined === row.removedAt).map((row) => [row.lichessId, row.type]),
		);
	}

	private async previousAttempts(
		previous: TrainingCycleRow | undefined,
	): Promise<ReadonlyMap<string, PreviousAttempt>> {
		if (undefined === previous) {
			return new Map();
		}

		const items = await this.repository.findAllByIndex('cycleItem', 'cycleUuid', previous.uuid);
		const slots = new Set(items.map((item) => item.uuid));
		const attempts = await this.repository.findAllByIndex(
			'attempt',
			'trainingUuid',
			previous.trainingUuid,
		);

		return new Map(
			attempts
				.filter((attempt) => slots.has(attempt.cycleItemUuid ?? ''))
				.map((attempt) => [attempt.lichessId, attempt]),
		);
	}
}

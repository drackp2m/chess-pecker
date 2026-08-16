import { Injectable, inject } from '@angular/core';
import type { PuzzleAttemptKind, TrainingCycle } from '@chesspecker/api-definitions';

import { Puzzle } from '@app/definition/puzzle.type';
import { AttemptRepository } from '@app/repository/attempt.repository';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { PuzzleRepository } from '@app/repository/puzzle.repository';
import { TrainingRunRepository } from '@app/repository/training-run.repository';
import { PuzzleMapper } from '@app/util/puzzle-mapper';

export interface SolvedAttempt {
	readonly row: AttemptRow;
	readonly puzzle: Puzzle;
}

export interface TrainingHistoryScope {
	readonly trainingUuid: string;
	readonly kind: PuzzleAttemptKind;
	readonly roundUuid?: string;
}

type PassFilter = (row: AttemptRow) => boolean;

@Injectable({
	providedIn: 'root',
})
export class TrainingHistoryUseCase {
	private readonly attempts = inject(AttemptRepository);
	private readonly puzzles = inject(PuzzleRepository);
	private readonly runs = inject(TrainingRunRepository);

	async list(scope: TrainingHistoryScope): Promise<readonly SolvedAttempt[]> {
		const pass = await this.passFilter(scope);

		if (undefined === pass) {
			return [];
		}

		const rows = await this.attempts.findAllByIndex('attempt', 'trainingUuid', scope.trainingUuid);
		const finished = rows
			.filter((row) => scope.kind === row.kind && 'open' !== row.closure && pass(row))
			.sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime());
		const entries = await Promise.all(finished.map((row) => this.toEntry(row)));

		return entries.filter((entry): entry is SolvedAttempt => undefined !== entry);
	}

	private async passFilter(scope: TrainingHistoryScope): Promise<PassFilter | undefined> {
		if ('calibration' === scope.kind) {
			const { roundUuid } = scope;

			return undefined === roundUuid ? undefined : (row) => row.roundUuid === roundUuid;
		}

		const started = await this.startOfPass(scope.trainingUuid);

		return undefined === started ? undefined : (row) => started <= row.updatedAt;
	}

	private async startOfPass(trainingUuid: string): Promise<Date | undefined> {
		try {
			return this.openedAt(await this.runs.listCycles(trainingUuid));
		} catch {
			return undefined;
		}
	}

	private openedAt(cycles: readonly TrainingCycle[]): Date | undefined {
		const latest = cycles.reduce<TrainingCycle | undefined>(
			(kept, cycle) => (undefined === kept || kept.index < cycle.index ? cycle : kept),
			undefined,
		);
		const pass = cycles.find((cycle) => 'running' === cycle.status) ?? latest;

		return undefined === pass ? undefined : new Date(pass.createdAt);
	}

	private async toEntry(row: AttemptRow): Promise<SolvedAttempt | undefined> {
		const stored = await this.puzzles.find('puzzle', row.lichessId).catch(() => undefined);

		return undefined === stored ? undefined : { row, puzzle: PuzzleMapper.toPuzzle(stored) };
	}
}

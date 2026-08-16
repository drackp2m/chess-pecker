import { Injectable, inject } from '@angular/core';
import type {
	ApiPuzzle,
	CalibrationRound,
	Training,
	TrainingCycle,
	TrainingCycleItem,
} from '@chesspecker/api-definitions';

import {
	CalibrationPuzzleRow,
	CalibrationRoundRow,
	TrainingCycleRow,
	TrainingRow,
} from '@app/repository/definition/training-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';

@Injectable({
	providedIn: 'root',
})
export class TrainingMirrorUseCase {
	private readonly repository = inject(TrainingLocalRepository);

	async trainings(trainings: readonly Training[]): Promise<void> {
		await Promise.all(trainings.map((training) => this.training(training)));
	}

	async training(training: Training): Promise<TrainingRow> {
		const stored = await this.repository.find('training', training.uuid);
		const row: TrainingRow = {
			uuid: training.uuid,
			status: training.status,
			createdAt: stored?.createdAt ?? new Date(training.createdAt),
			updatedAt: new Date(training.updatedAt),
			syncedAt: new Date(),
			...(undefined === training.finishedReason ? {} : { finishedReason: training.finishedReason }),
			...(undefined === training.finishedAt ? {} : { finishedAt: new Date(training.finishedAt) }),
		};

		return this.repository.insert('training', row);
	}

	async rounds(trainingUuid: string, rounds: readonly CalibrationRound[]): Promise<void> {
		await Promise.all(rounds.map((round) => this.round(trainingUuid, round)));
	}

	async round(trainingUuid: string, round: CalibrationRound): Promise<CalibrationRoundRow> {
		const stored = await this.repository.find('calibrationRound', round.uuid);
		const now = new Date();

		return this.repository.insert('calibrationRound', {
			uuid: round.uuid,
			trainingUuid,
			index: round.index,
			kind: round.kind,
			rating: round.rating,
			outcome: round.outcome,
			createdAt: stored?.createdAt ?? now,
			updatedAt: stored?.updatedAt ?? now,
			syncedAt: now,
		});
	}

	async roundPuzzles(
		roundUuid: string,
		puzzles: readonly ApiPuzzle[],
		attempted: number,
	): Promise<void> {
		const stored = await this.repository.findAllByIndex(
			'calibrationPuzzle',
			'roundUuid',
			roundUuid,
		);
		const known = new Set(stored.map((row) => row.lichessId));
		const rows = puzzles
			.map((puzzle, offset) => this.toDealtRow(roundUuid, puzzle, attempted + offset))
			.filter((row) => !known.has(row.lichessId));

		if (0 < rows.length) {
			await this.repository.batchInsert('calibrationPuzzle', rows);
		}
	}

	async cycles(trainingUuid: string, cycles: readonly TrainingCycle[]): Promise<void> {
		await Promise.all(cycles.map((cycle) => this.cycle(trainingUuid, cycle)));
	}

	async cycle(trainingUuid: string, cycle: TrainingCycle): Promise<TrainingCycleRow> {
		const stored = await this.repository.find('cycle', cycle.uuid);
		const now = new Date();

		return this.repository.insert('cycle', {
			uuid: cycle.uuid,
			trainingUuid,
			index: cycle.index,
			status: cycle.status,
			createdAt: stored?.createdAt ?? new Date(cycle.createdAt),
			updatedAt: stored?.updatedAt ?? new Date(cycle.createdAt),
			syncedAt: now,
		});
	}

	async cycleItem(cycleUuid: string, item: TrainingCycleItem): Promise<void> {
		const now = new Date();
		const trainingUuid = (await this.repository.find('cycle', cycleUuid))?.trainingUuid;

		if (undefined === trainingUuid) {
			return;
		}

		const stored = await this.repository.find('trainingPuzzle', item.trainingPuzzle.uuid);
		const storedItem = await this.repository.find('cycleItem', item.uuid);

		await this.repository.insert('trainingPuzzle', {
			uuid: item.trainingPuzzle.uuid,
			trainingUuid,
			lichessId: item.trainingPuzzle.puzzle.lichessId,
			rating: item.trainingPuzzle.puzzle.rating,
			createdAt: stored?.createdAt ?? now,
			updatedAt: stored?.updatedAt ?? now,
			syncedAt: now,
		});

		await this.repository.insert('cycleItem', {
			uuid: item.uuid,
			cycleUuid,
			trainingPuzzleUuid: item.trainingPuzzle.uuid,
			lichessId: item.trainingPuzzle.puzzle.lichessId,
			position: item.position,
			createdAt: storedItem?.createdAt ?? now,
			updatedAt: storedItem?.updatedAt ?? now,
			syncedAt: now,
		});
	}

	private toDealtRow(roundUuid: string, puzzle: ApiPuzzle, position: number): CalibrationPuzzleRow {
		const now = new Date();

		return {
			uuid: crypto.randomUUID(),
			roundUuid,
			lichessId: puzzle.lichessId,
			position,
			createdAt: now,
			updatedAt: now,
			syncedAt: now,
		};
	}
}

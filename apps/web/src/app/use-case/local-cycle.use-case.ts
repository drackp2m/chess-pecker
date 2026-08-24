import { Injectable, inject } from '@angular/core';

import { TrainingPolicy } from '@app/definition/training-policy.constant';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import {
	CycleItemRow,
	TrainingCycleRow,
	TrainingPuzzleRow,
} from '@app/repository/definition/training-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { LocalCalibrationUseCase } from '@app/use-case/local-calibration.use-case';
import { LocalTrainingUseCase } from '@app/use-case/local-training.use-case';
import { born, touch } from '@app/use-case/sync/local-record';
import { buildCycleOrder } from '@app/util/cycle-order';
import { clampRatingBucket, ratingBucketCeiling } from '@app/util/rating-bucket';

export interface LocalCycleSlot {
	readonly cycle: TrainingCycleRow;
	readonly item: CycleItemRow;
	readonly puzzle: PuzzleRow;
}

@Injectable({
	providedIn: 'root',
})
export class LocalCycleUseCase {
	private readonly repository = inject(TrainingLocalRepository);
	private readonly trainings = inject(LocalTrainingUseCase);
	private readonly calibration = inject(LocalCalibrationUseCase);

	async listSet(trainingUuid: string): Promise<readonly TrainingPuzzleRow[]> {
		return this.repository.findAllByIndex('trainingPuzzle', 'trainingUuid', trainingUuid);
	}

	async selectSet(trainingUuid: string, size: number): Promise<number> {
		const training = await this.trainings.find(trainingUuid);

		if ('planning' !== training?.status) {
			throw new Error('The calibration is not finished');
		}

		if (0 < (await this.listSet(trainingUuid)).length) {
			throw new Error('The set is already selected');
		}

		const accepted = await this.calibration.findAcceptedRound(trainingUuid);

		if (undefined === accepted) {
			throw new Error('There is no calibrated rating');
		}

		const puzzles = await this.sampleBand(accepted.rating, size);

		if (0 === puzzles.length) {
			throw new Error('Not enough local puzzles in that rating band');
		}

		await this.repository.batchInsert('trainingPuzzle', this.toSetRows(trainingUuid, puzzles));

		return puzzles.length;
	}

	async listCycles(trainingUuid: string): Promise<readonly TrainingCycleRow[]> {
		const rows = await this.repository.findAllByIndex('cycle', 'trainingUuid', trainingUuid);

		return rows.sort((left, right) => left.index - right.index);
	}

	async findRunningCycle(trainingUuid: string): Promise<TrainingCycleRow | undefined> {
		return (await this.listCycles(trainingUuid)).find((cycle) => 'running' === cycle.status);
	}

	async startCycle(trainingUuid: string): Promise<TrainingCycleRow> {
		const cycles = await this.assertCanStart(trainingUuid);
		const set = await this.listSet(trainingUuid);

		if (0 === set.length) {
			throw new Error('The set is empty');
		}

		const expected = cycles
			.map((cycle) => cycle.expectedItems)
			.filter((count): count is number => undefined !== count);

		if (0 < expected.length && Math.max(...expected) !== set.length) {
			throw new Error('The set is not fully replicated on this device');
		}

		const cycle = await this.insertCycle(trainingUuid, cycles.length + 1, set.length);

		await this.repository.batchInsert('cycleItem', this.toItemRows(cycle, buildCycleOrder(set)));
		await this.trainings.updateStatus(trainingUuid, 'running');

		return cycle;
	}

	async listItems(cycleUuid: string): Promise<readonly CycleItemRow[]> {
		const rows = await this.repository.findAllByIndex('cycleItem', 'cycleUuid', cycleUuid);

		return rows.sort((left, right) => left.position - right.position);
	}

	async findItem(uuid: string): Promise<CycleItemRow | undefined> {
		return this.repository.find('cycleItem', uuid);
	}

	async nextSlot(trainingUuid: string): Promise<LocalCycleSlot | undefined> {
		const cycle = await this.findRunningCycle(trainingUuid);

		if (undefined === cycle) {
			throw new Error('There is no cycle in progress');
		}

		const items = await this.listItems(cycle.uuid);

		if (!isWholeCycle(cycle, items)) {
			throw new Error('The cycle is not fully replicated on this device');
		}

		const attempted = new Set(
			(await this.closedAttempts(trainingUuid)).map((attempt) => attempt.cycleItemUuid),
		);
		const item = items.find((candidate) => !attempted.has(candidate.uuid));

		if (undefined === item) {
			return undefined;
		}

		const puzzle = await this.repository.find('puzzle', item.lichessId);

		if (undefined === puzzle) {
			throw new Error('The next exercise is missing from the local catalog');
		}

		return { cycle, item, puzzle };
	}

	async closeIfComplete(trainingUuid: string, cycleUuid: string): Promise<boolean> {
		const cycle = await this.repository.find('cycle', cycleUuid);

		if ('running' !== cycle?.status) {
			return undefined !== cycle;
		}

		const items = await this.listItems(cycleUuid);

		if (!isWholeCycle(cycle, items)) {
			return false;
		}

		const attempts = await this.closedAttempts(trainingUuid);
		const attempted = items.filter((item) =>
			attempts.some((attempt) => attempt.cycleItemUuid === item.uuid),
		);

		if (attempted.length < items.length) {
			return false;
		}

		await this.finishCycle(trainingUuid, cycle);

		return true;
	}

	async abandonRunningCycle(trainingUuid: string): Promise<void> {
		const running = await this.findRunningCycle(trainingUuid);

		if (undefined !== running) {
			await this.repository.insert(
				'cycle',
				touch<TrainingCycleRow>({ ...running, status: 'cancelled' }),
			);
		}
	}

	private async finishCycle(trainingUuid: string, cycle: TrainingCycleRow): Promise<void> {
		await this.repository.insert(
			'cycle',
			touch<TrainingCycleRow>({ ...cycle, status: 'finished' }),
		);

		if (TrainingPolicy.maxCycles <= cycle.index) {
			await this.trainings.finish(trainingUuid, 'finished', 'max-cycles');
		}
	}

	private async assertCanStart(trainingUuid: string): Promise<readonly TrainingCycleRow[]> {
		const training = await this.trainings.find(trainingUuid);

		if (undefined === training || !['planning', 'running'].includes(training.status)) {
			throw new Error('The training is not ready for cycles');
		}

		const cycles = await this.listCycles(trainingUuid);

		if (cycles.some((cycle) => 'running' === cycle.status)) {
			throw new Error('A cycle is already in progress');
		}

		if (TrainingPolicy.maxCycles <= cycles.length) {
			throw new Error('The training reached its last cycle');
		}

		if (0 === cycles.length && undefined === (await this.trainings.currentGoal(trainingUuid))) {
			throw new Error('A goal is required before the first cycle');
		}

		return cycles;
	}

	private async sampleBand(rating: number, size: number): Promise<readonly PuzzleRow[]> {
		const spread = TrainingPolicy.setRatingSpread;

		return this.repository.sampleByRating(
			clampRatingBucket(rating - spread),
			ratingBucketCeiling(clampRatingBucket(rating + spread)),
			size,
		);
	}

	private async insertCycle(
		trainingUuid: string,
		index: number,
		expectedItems: number,
	): Promise<TrainingCycleRow> {
		const now = new Date();

		return this.repository.insert(
			'cycle',
			born<TrainingCycleRow>({
				uuid: crypto.randomUUID(),
				trainingUuid,
				index,
				status: 'running',
				expectedItems,
				createdAt: now,
				updatedAt: now,
			}),
		);
	}

	private toSetRows(trainingUuid: string, puzzles: readonly PuzzleRow[]): TrainingPuzzleRow[] {
		const now = new Date();

		return puzzles.map((puzzle) =>
			born<TrainingPuzzleRow>({
				uuid: crypto.randomUUID(),
				trainingUuid,
				lichessId: puzzle.lichessId,
				rating: puzzle.rating,
				createdAt: now,
				updatedAt: now,
			}),
		);
	}

	private toItemRows(cycle: TrainingCycleRow, set: readonly TrainingPuzzleRow[]): CycleItemRow[] {
		const now = new Date();

		return set.map((trainingPuzzle, position) =>
			born<CycleItemRow>({
				uuid: crypto.randomUUID(),
				cycleUuid: cycle.uuid,
				trainingPuzzleUuid: trainingPuzzle.uuid,
				lichessId: trainingPuzzle.lichessId,
				position,
				createdAt: now,
				updatedAt: now,
			}),
		);
	}

	private async closedAttempts(trainingUuid: string): Promise<readonly AttemptRow[]> {
		const rows = await this.repository.findAllByIndex('attempt', 'trainingUuid', trainingUuid);

		return rows.filter((row) => 'cycle' === row.kind);
	}
}

function isWholeCycle(cycle: TrainingCycleRow, items: readonly CycleItemRow[]): boolean {
	return undefined !== cycle.expectedItems && items.length === cycle.expectedItems;
}

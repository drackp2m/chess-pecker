import { Injectable, inject } from '@angular/core';
import type { SyncPartialCycle } from '@chesspecker/api-definitions';

import { TrainingPolicy } from '@app/definition/training-policy.constant';
import { I18n, i18nRef } from '@app/i18n';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import {
	CycleItemRow,
	TrainingCycleRow,
	TrainingPuzzleRow,
	TrainingRow,
} from '@app/repository/definition/training-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { LocalCalibrationUseCase } from '@app/use-case/local-calibration.use-case';
import { LocalTrainingUseCase } from '@app/use-case/local-training.use-case';
import { born, touch } from '@app/use-case/sync/local-record';
import { buildCycleOrder } from '@app/util/cycle-order';
import { LocalFailureError } from '@app/util/local-failure-error';
import { clampRatingBucket, ratingBucketCeiling } from '@app/util/rating-bucket';
import { isWholeCycle } from '@app/util/whole-cycle';

interface StartableTraining {
	readonly training: TrainingRow;
	readonly cycles: readonly TrainingCycleRow[];
}

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
			throw new LocalFailureError(
				i18nRef(I18n.common.CATALOG_EMPTY),
				'Not enough local puzzles in that rating band',
			);
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

	/**
	 * What the server says a cycle should hold, when it is more than this device believed.
	 * Without it a truncation living only in the cloud stays invisible here until the download
	 * happens to bring the short cycle down. The number is the server's own, so the row is not
	 * marked pending: pushing it back would only tell the server what it just said.
	 */
	async declarePartial(partial: readonly SyncPartialCycle[]): Promise<number> {
		let declared = 0;

		for (const entry of partial) {
			const cycle = await this.repository.find('cycle', entry.uuid);

			if (undefined === cycle || entry.itemCount <= (cycle.expectedItems ?? 0)) {
				continue;
			}

			await this.repository.insert('cycle', { ...cycle, expectedItems: entry.itemCount });
			declared++;
		}

		return declared;
	}

	async startCycle(trainingUuid: string): Promise<TrainingCycleRow> {
		const { training, cycles } = await this.assertCanStart(trainingUuid);
		const set = await this.listSet(trainingUuid);

		if (0 === set.length) {
			throw new Error('The set is empty');
		}

		const previous = cycles.at(-1)?.expectedItems;

		if (undefined !== previous && previous !== set.length) {
			throw new Error('The set is not fully replicated on this device');
		}

		const cycle = this.newCycle(trainingUuid, cycles.length + 1, set.length);

		await this.openCycle(training, cycle, this.toItemRows(cycle, buildCycleOrder(set)));

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
			throw new LocalFailureError(
				i18nRef(I18n.training.CYCLE_NEEDS_REPAIR),
				'The cycle is missing slots on this device and has to be repaired',
			);
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

	private async assertCanStart(trainingUuid: string): Promise<StartableTraining> {
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

		return { training, cycles };
	}

	private async sampleBand(rating: number, size: number): Promise<readonly PuzzleRow[]> {
		const spread = TrainingPolicy.setRatingSpread;

		return this.repository.sampleByRating(
			clampRatingBucket(rating - spread),
			ratingBucketCeiling(clampRatingBucket(rating + spread)),
			size,
		);
	}

	private newCycle(trainingUuid: string, index: number, expectedItems: number): TrainingCycleRow {
		const now = new Date();

		return born<TrainingCycleRow>({
			uuid: crypto.randomUUID(),
			trainingUuid,
			index,
			status: 'running',
			expectedItems,
			createdAt: now,
			updatedAt: now,
		});
	}

	/**
	 * The cycle, its slots and the training status commit together. Split apart, a crash
	 * between the first two leaves a cycle with no slots, which blocks like a truncated one.
	 */
	private async openCycle(
		training: TrainingRow,
		cycle: TrainingCycleRow,
		items: readonly CycleItemRow[],
	): Promise<void> {
		await this.repository.runInTransaction(
			['cycle', 'cycleItem', 'training'],
			'readwrite',
			async (transaction) => {
				const slots = transaction.objectStore('cycleItem');

				await transaction.objectStore('cycle').put(cycle);
				await Promise.all(items.map((item) => slots.put(item)));

				if ('running' !== training.status) {
					await transaction
						.objectStore('training')
						.put(touch<TrainingRow>({ ...training, status: 'running' }));
				}
			},
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

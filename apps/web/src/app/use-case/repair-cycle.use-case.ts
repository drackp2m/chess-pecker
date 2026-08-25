import { Injectable, inject } from '@angular/core';

import {
	CycleItemRow,
	TrainingCycleRow,
	TrainingPuzzleRow,
} from '@app/repository/definition/training-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { LocalTrainingUseCase, isActiveTraining } from '@app/use-case/local-training.use-case';
import { born, touch } from '@app/use-case/sync/local-record';
import { CyclePlacement, planCycleRepair } from '@app/util/cycle-repair';
import { expectedCycleItems } from '@app/util/whole-cycle';

export interface PartialCycle {
	readonly uuid: string;
	readonly index: number;
	readonly itemCount: number;
	readonly storedItems: number;
	/** A set still coming down cannot fill the gaps: the cycle waits rather than repairs. */
	readonly canRepair: boolean;
}

export interface CycleRepair {
	readonly cycleUuid: string;
	readonly expectedItems: number;
	readonly storedItems: number;
	readonly restoredItems: number;
}

@Injectable({
	providedIn: 'root',
})
export class RepairCycleUseCase {
	private readonly repository = inject(TrainingLocalRepository);
	private readonly cycles = inject(LocalCycleUseCase);
	private readonly trainings = inject(LocalTrainingUseCase);

	async repairAll(): Promise<readonly CycleRepair[]> {
		const repairs: CycleRepair[] = [];
		const trainings = (await this.trainings.list()).filter((training) =>
			isActiveTraining(training),
		);

		for (const training of trainings) {
			for (const partial of await this.listPartial(training.uuid)) {
				const repair = partial.canRepair ? await this.repairOne(partial.uuid) : undefined;

				if (undefined !== repair) {
					repairs.push(repair);
				}
			}
		}

		return repairs;
	}

	async listPartial(trainingUuid: string): Promise<readonly PartialCycle[]> {
		const setSize = await this.cycles.countSet(trainingUuid);

		if (0 === setSize) {
			return [];
		}

		const cycles = await this.cycles.listCycles(trainingUuid);
		const partial: PartialCycle[] = [];

		for (const cycle of cycles) {
			const storedItems = await this.cycles.countItems(cycle.uuid);
			const itemCount = expectedCycleItems(cycle, setSize);

			if (storedItems < itemCount) {
				partial.push({
					uuid: cycle.uuid,
					index: cycle.index,
					itemCount,
					storedItems,
					canRepair: itemCount <= setSize,
				});
			}
		}

		return partial;
	}

	async execute(cycleUuid: string): Promise<CycleRepair> {
		const cycle = await this.repository.find('cycle', cycleUuid);

		if (undefined === cycle) {
			throw new Error('The cycle is missing from this device');
		}

		const set = await this.cycles.listSet(cycle.trainingUuid);
		const items = await this.cycles.listItems(cycleUuid);
		const expectedItems = expectedCycleItems(cycle, set.length);

		if (set.length < expectedItems) {
			throw new Error('The set is not fully replicated on this device');
		}

		await this.assertNothingElseRunning(cycle);

		const placements = planCycleRepair(
			set,
			this.unplaced(set, items),
			this.freePositions(expectedItems, items),
		);
		const rows = this.toItemRows(cycle, placements);

		if (0 < rows.length) {
			await this.save(cycle, expectedItems, rows);
		}

		return { cycleUuid, expectedItems, storedItems: items.length, restoredItems: rows.length };
	}

	private async repairOne(cycleUuid: string): Promise<CycleRepair | undefined> {
		try {
			return await this.execute(cycleUuid);
		} catch (error) {
			console.error(`Could not repair the cycle \`${cycleUuid}\``, error);

			return undefined;
		}
	}

	private async assertNothingElseRunning(cycle: TrainingCycleRow): Promise<void> {
		const running = await this.cycles.findRunningCycle(cycle.trainingUuid);

		if (undefined !== running && running.uuid !== cycle.uuid) {
			throw new Error('Another cycle is in progress');
		}
	}

	private freePositions(expectedItems: number, items: readonly CycleItemRow[]): number[] {
		const taken = new Set(items.map((item) => item.position));

		return Array.from({ length: expectedItems }, (_unused, position) => position).filter(
			(position) => !taken.has(position),
		);
	}

	private unplaced(
		set: readonly TrainingPuzzleRow[],
		items: readonly CycleItemRow[],
	): readonly TrainingPuzzleRow[] {
		const placed = new Set(items.map((item) => item.trainingPuzzleUuid));

		return set.filter((trainingPuzzle) => !placed.has(trainingPuzzle.uuid));
	}

	private toItemRows(
		cycle: TrainingCycleRow,
		placements: readonly CyclePlacement<TrainingPuzzleRow>[],
	): CycleItemRow[] {
		const now = new Date();

		return placements.map(({ item, position }) =>
			born<CycleItemRow>({
				uuid: crypto.randomUUID(),
				cycleUuid: cycle.uuid,
				trainingPuzzleUuid: item.uuid,
				lichessId: item.lichessId,
				position,
				createdAt: now,
				updatedAt: now,
			}),
		);
	}

	private async save(
		cycle: TrainingCycleRow,
		expectedItems: number,
		rows: readonly CycleItemRow[],
	): Promise<void> {
		await this.repository.runInTransaction(
			['cycleItem', 'cycle'],
			'readwrite',
			async (transaction) => {
				const store = transaction.objectStore('cycleItem');

				await Promise.all(rows.map((row) => store.put(row)));
				await transaction
					.objectStore('cycle')
					.put(touch<TrainingCycleRow>({ ...cycle, status: 'running', expectedItems }));
			},
		);
	}
}

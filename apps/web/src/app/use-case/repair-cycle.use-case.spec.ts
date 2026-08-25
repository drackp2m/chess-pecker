import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	CycleItemRow,
	TrainingCycleRow,
	TrainingPuzzleRow,
} from '@app/repository/definition/training-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { LocalTrainingUseCase } from '@app/use-case/local-training.use-case';
import { RepairCycleUseCase } from '@app/use-case/repair-cycle.use-case';
import { cycleBlock } from '@app/util/cycle-order';

const TRAINING = 'training-1';

const CYCLE = 'cycle-2';

const BORN = new Date('2026-08-01T09:00:00.000Z');

interface Options {
	readonly cycles?: readonly TrainingCycleRow[];
	readonly set?: readonly TrainingPuzzleRow[];
	readonly items?: readonly CycleItemRow[];
	readonly running?: TrainingCycleRow | undefined;
	readonly trainings?: readonly { readonly uuid: string; readonly status: string }[];
}

function cycle(over: Partial<TrainingCycleRow> = {}): TrainingCycleRow {
	return {
		uuid: CYCLE,
		trainingUuid: TRAINING,
		index: 2,
		status: 'running',
		expectedItems: 1000,
		createdAt: BORN,
		updatedAt: BORN,
		...over,
	};
}

function agedCycle(): TrainingCycleRow {
	const { expectedItems: _unused, ...rest } = cycle();

	return rest;
}

/** The shape of the real case: 1000 exercises over three rating blocks. */
function set(sizes: Readonly<Record<number, number>> = { 1100: 344, 1200: 330, 1300: 326 }) {
	return Object.entries(sizes).flatMap(([rating, size]) =>
		Array.from({ length: size }, (_unused, index): TrainingPuzzleRow => ({
			uuid: `${rating}-${index.toString()}`,
			trainingUuid: TRAINING,
			lichessId: `L${rating}${index.toString()}`,
			rating: Number(rating),
			createdAt: BORN,
			updatedAt: BORN,
		})),
	);
}

function slots(entries: readonly TrainingPuzzleRow[]): CycleItemRow[] {
	return entries.map((entry, position): CycleItemRow => ({
		uuid: `item-${position.toString()}`,
		cycleUuid: CYCLE,
		trainingPuzzleUuid: entry.uuid,
		lichessId: entry.lichessId,
		position,
		createdAt: BORN,
		updatedAt: BORN,
		syncedAt: BORN,
	}));
}

/** What survived the truncated upload: one slot out of every three, in its own position. */
function survivors(entries: readonly TrainingPuzzleRow[]): CycleItemRow[] {
	return slots(entries).filter((item) => 0 === item.position % 3);
}

function configure(options: Options = {}) {
	const written: { cycleItem: CycleItemRow[]; cycle: TrainingCycleRow[] } = {
		cycleItem: [],
		cycle: [],
	};
	const cycles = options.cycles ?? [cycle()];
	const repository = {
		find: vi.fn((_store: string, uuid: string) =>
			Promise.resolve(cycles.find((row) => row.uuid === uuid)),
		),
		runInTransaction: vi.fn(
			(_stores: readonly string[], _mode: string, run: (transaction: unknown) => unknown) =>
				Promise.resolve(
					run({
						objectStore: (name: 'cycleItem' | 'cycle') => ({
							put: (row: unknown) => {
								written[name].push(row as CycleItemRow & TrainingCycleRow);

								return Promise.resolve();
							},
						}),
					}),
				),
		),
	};
	const localCycles = {
		listSet: vi.fn(() => Promise.resolve(options.set ?? [])),
		countSet: vi.fn(() => Promise.resolve((options.set ?? []).length)),
		listCycles: vi.fn(() => Promise.resolve(cycles)),
		listItems: vi.fn(() => Promise.resolve(options.items ?? [])),
		countItems: vi.fn(() => Promise.resolve((options.items ?? []).length)),
		findRunningCycle: vi.fn(() => Promise.resolve(options.running)),
	};
	const localTrainings = {
		list: vi.fn(() => Promise.resolve(options.trainings ?? [])),
	};

	TestBed.configureTestingModule({
		providers: [
			{ provide: TrainingLocalRepository, useValue: repository },
			{ provide: LocalCycleUseCase, useValue: localCycles },
			{ provide: LocalTrainingUseCase, useValue: localTrainings },
		],
	});

	return {
		repository,
		localCycles,
		localTrainings,
		written,
		repair: TestBed.inject(RepairCycleUseCase),
	};
}

describe('RepairCycleUseCase.listPartial', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('lists a cycle with fewer slots than it declared, and says how many are missing', async () => {
		const entries = set();
		const { repair } = configure({ set: entries, items: survivors(entries) });

		await expect(repair.listPartial(TRAINING)).resolves.toEqual([
			{ uuid: CYCLE, index: 2, itemCount: 1000, storedItems: 334, canRepair: true },
		]);
	});

	it('says nothing about a cycle that holds every slot it declared', async () => {
		const entries = set({ 1100: 3 });
		const { repair } = configure({
			cycles: [cycle({ expectedItems: 3 })],
			set: entries,
			items: slots(entries),
		});

		await expect(repair.listPartial(TRAINING)).resolves.toEqual([]);
	});

	it('falls back to the size of the set for a cycle older than the declared count', async () => {
		const entries = set({ 1100: 6 });
		const { repair } = configure({
			cycles: [agedCycle()],
			set: entries,
			items: survivors(entries),
		});

		await expect(repair.listPartial(TRAINING)).resolves.toEqual([
			{ uuid: CYCLE, index: 2, itemCount: 6, storedItems: 2, canRepair: true },
		]);
	});

	it('has nothing to say while the set has not landed at all', async () => {
		const { repair } = configure({ set: [] });

		await expect(repair.listPartial(TRAINING)).resolves.toEqual([]);
	});

	it('shows the cycle but withholds the repair while the set is only half down', async () => {
		const entries = set({ 1100: 600 });
		const { repair } = configure({ set: entries, items: survivors(entries) });

		await expect(repair.listPartial(TRAINING)).resolves.toEqual([
			{ uuid: CYCLE, index: 2, itemCount: 1000, storedItems: 200, canRepair: false },
		]);
	});
});

describe('RepairCycleUseCase.execute', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('gives the cycle back a whole, valid order', async () => {
		const entries = set();
		const kept = survivors(entries);
		const { repair, written } = configure({ set: entries, items: kept });

		const report = await repair.execute(CYCLE);

		const positions = [...kept, ...written.cycleItem].map((item) => item.position);

		expect(report).toEqual({
			cycleUuid: CYCLE,
			expectedItems: 1000,
			storedItems: 334,
			restoredItems: 666,
		});
		expect(new Set(positions).size).toStrictEqual(1000);
		expect(Math.max(...positions)).toStrictEqual(999);
	});

	it('places every restored slot inside the rating block that owns its positions', async () => {
		const entries = set();
		const { repair, written } = configure({ set: entries, items: survivors(entries) });
		const byUuid = new Map(entries.map((entry) => [entry.uuid, entry]));

		await repair.execute(CYCLE);

		const blocks = new Map([
			[1100, { start: 0, end: 344 }],
			[1200, { start: 344, end: 674 }],
			[1300, { start: 674, end: 1000 }],
		]);

		for (const item of written.cycleItem) {
			const rating = byUuid.get(item.trainingPuzzleUuid)?.rating ?? 0;
			const range = blocks.get(cycleBlock(rating));

			expect(item.position).toBeGreaterThanOrEqual(range?.start ?? -1);
			expect(item.position).toBeLessThan(range?.end ?? -1);
		}
	});

	it('hands out every exercise the cycle was still missing, and no repeats', async () => {
		const entries = set();
		const kept = survivors(entries);
		const { repair, written } = configure({ set: entries, items: kept });

		await repair.execute(CYCLE);

		const used = [...kept, ...written.cycleItem].map((item) => item.trainingPuzzleUuid);

		expect(new Set(used)).toEqual(new Set(entries.map((entry) => entry.uuid)));
	});

	it('reopens the cycle and leaves the restored slots waiting to go up', async () => {
		const entries = set({ 1100: 6 });
		const { repair, written } = configure({
			cycles: [cycle({ expectedItems: 6, status: 'finished' })],
			set: entries,
			items: survivors(entries),
		});

		await repair.execute(CYCLE);

		expect(written.cycle).toMatchObject([{ uuid: CYCLE, status: 'running', expectedItems: 6 }]);
		expect(written.cycleItem.every((item) => undefined !== item.pendingSince)).toBe(true);
	});

	it('writes nothing when the cycle is already whole, so repeating it is harmless', async () => {
		const entries = set({ 1100: 3 });
		const kept = slots(entries);
		const { repair, repository } = configure({
			cycles: [cycle({ expectedItems: 3 })],
			set: entries,
			items: kept,
		});

		await expect(repair.execute(CYCLE)).resolves.toMatchObject({ restoredItems: 0 });
		expect(repository.runInTransaction).not.toHaveBeenCalled();
	});

	it('refuses a cycle this device does not hold', async () => {
		const { repair } = configure({ cycles: [] });

		await expect(repair.execute(CYCLE)).rejects.toThrow('The cycle is missing from this device');
	});

	it('refuses while the set is still coming down', async () => {
		const entries = set({ 1100: 600 });
		const { repair } = configure({ set: entries, items: survivors(entries) });

		await expect(repair.execute(CYCLE)).rejects.toThrow(
			'The set is not fully replicated on this device',
		);
	});

	it('refuses while another cycle is in progress', async () => {
		const entries = set({ 1100: 6 });
		const { repair } = configure({
			cycles: [cycle({ expectedItems: 6 })],
			set: entries,
			items: survivors(entries),
			running: cycle({ uuid: 'cycle-3', index: 3 }),
		});

		await expect(repair.execute(CYCLE)).rejects.toThrow('Another cycle is in progress');
	});
});

describe('RepairCycleUseCase.repairAll', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	const running = [{ uuid: TRAINING, status: 'running' }];

	it('puts a truncated cycle back without anybody asking for it', async () => {
		const entries = set({ 1100: 6 });
		const { repair, written } = configure({
			cycles: [cycle({ expectedItems: 6 })],
			set: entries,
			items: survivors(entries),
			trainings: running,
		});

		await expect(repair.repairAll()).resolves.toEqual([
			{ cycleUuid: CYCLE, expectedItems: 6, storedItems: 2, restoredItems: 4 },
		]);
		expect(written.cycleItem).toHaveLength(4);
	});

	it('sees the truncation the declared count hid, because the set is the size that counts', async () => {
		const entries = set({ 1100: 6 });
		const { repair } = configure({
			cycles: [cycle({ expectedItems: 2 })],
			set: entries,
			items: survivors(entries),
			trainings: running,
		});

		await expect(repair.repairAll()).resolves.toMatchObject([
			{ expectedItems: 6, restoredItems: 4 },
		]);
	});

	it('leaves alone a training that is no longer in play', async () => {
		const entries = set({ 1100: 6 });
		const { repair, written } = configure({
			cycles: [cycle({ expectedItems: 6 })],
			set: entries,
			items: survivors(entries),
			trainings: [{ uuid: TRAINING, status: 'cancelled' }],
		});

		await expect(repair.repairAll()).resolves.toEqual([]);
		expect(written.cycleItem).toHaveLength(0);
	});

	it('waits instead of repairing while the set is still coming down', async () => {
		const entries = set({ 1100: 600 });
		const { repair, written } = configure({
			set: entries,
			items: survivors(entries),
			trainings: running,
		});

		await expect(repair.repairAll()).resolves.toEqual([]);
		expect(written.cycleItem).toHaveLength(0);
	});

	it('swallows a cycle it cannot repair instead of dropping the pass', async () => {
		const entries = set({ 1100: 6 });
		const { repair } = configure({
			cycles: [cycle({ expectedItems: 6 })],
			set: entries,
			items: survivors(entries),
			running: cycle({ uuid: 'cycle-3', index: 3 }),
			trainings: running,
		});

		await expect(repair.repairAll()).resolves.toEqual([]);
	});
});

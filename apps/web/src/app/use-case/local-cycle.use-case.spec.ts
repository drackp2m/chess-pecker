import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18n } from '@app/i18n';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import {
	CycleItemRow,
	TrainingCycleRow,
	TrainingPuzzleRow,
} from '@app/repository/definition/training-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { LocalCalibrationUseCase } from '@app/use-case/local-calibration.use-case';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { LocalTrainingUseCase } from '@app/use-case/local-training.use-case';

const TRAINING = 'training-1';

function cycle(index: number, over: Partial<TrainingCycleRow> = {}): TrainingCycleRow {
	return {
		uuid: `cycle-${index.toString()}`,
		trainingUuid: TRAINING,
		index,
		status: 'finished',
		createdAt: new Date('2026-08-01T09:00:00.000Z'),
		updatedAt: new Date('2026-08-01T09:00:00.000Z'),
		...over,
	};
}

function set(size: number): TrainingPuzzleRow[] {
	return Array.from({ length: size }, (_unused, index) => ({
		uuid: `set-${index.toString()}`,
		trainingUuid: TRAINING,
		lichessId: `L${index.toString()}`,
		rating: 1500,
		createdAt: new Date('2026-08-01T09:00:00.000Z'),
		updatedAt: new Date('2026-08-01T09:00:00.000Z'),
	}));
}

interface Extra {
	readonly items?: readonly CycleItemRow[];
	readonly attempts?: readonly Partial<AttemptRow>[];
}

function configure(
	cycles: readonly TrainingCycleRow[],
	puzzles: readonly TrainingPuzzleRow[],
	extra: Extra = {},
) {
	const byStore: Record<string, readonly unknown[]> = {
		cycle: cycles,
		trainingPuzzle: puzzles,
		cycleItem: extra.items ?? [],
		attempt: extra.attempts ?? [],
	};
	const written: { cycle: unknown[]; cycleItem: unknown[]; training: unknown[] } = {
		cycle: [],
		cycleItem: [],
		training: [],
	};
	const repository = {
		findAllByIndex: vi.fn((store: string) => Promise.resolve(byStore[store] ?? [])),
		find: vi.fn((store: string, uuid: string) =>
			Promise.resolve(
				(byStore[store] ?? []).find((row) => (row as { uuid?: string }).uuid === uuid),
			),
		),
		insert: vi.fn((_store: string, row: unknown) => Promise.resolve(row)),
		batchInsert: vi.fn().mockResolvedValue(undefined),
		runInTransaction: vi.fn(
			(_stores: readonly string[], _mode: string, run: (transaction: unknown) => unknown) =>
				Promise.resolve(
					run({
						objectStore: (name: 'cycle' | 'cycleItem' | 'training') => ({
							put: (row: unknown) => {
								written[name].push(row);

								return Promise.resolve();
							},
						}),
					}),
				),
		),
	};
	const trainings = {
		find: vi.fn().mockResolvedValue({
			uuid: TRAINING,
			status: 'planning',
			createdAt: new Date('2026-08-01T09:00:00.000Z'),
			updatedAt: new Date('2026-08-01T09:00:00.000Z'),
		}),
		currentGoal: vi.fn().mockResolvedValue({ uuid: 'goal-1' }),
		updateStatus: vi.fn().mockResolvedValue(undefined),
	};

	TestBed.configureTestingModule({
		providers: [
			{ provide: TrainingLocalRepository, useValue: repository },
			{ provide: LocalTrainingUseCase, useValue: trainings },
			{ provide: LocalCalibrationUseCase, useValue: {} },
		],
	});

	return { repository, trainings, written, cycles: TestBed.inject(LocalCycleUseCase) };
}

describe('LocalCycleUseCase.startCycle', () => {
	beforeEach(() => {
		TestBed.resetTestingModule();
	});

	it('starts the first pass of a training that has none', async () => {
		const { cycles, written } = configure([], set(3));

		const started = await cycles.startCycle(TRAINING);

		expect(started).toMatchObject({ index: 1, status: 'running', expectedItems: 3 });
		expect(written.cycleItem).toHaveLength(3);
	});

	it('writes the pass, its slots and the training status as one commit', async () => {
		const { cycles, repository, written } = configure([], set(3));

		await cycles.startCycle(TRAINING);

		expect(repository.runInTransaction).toHaveBeenCalledTimes(1);
		expect(repository.runInTransaction).toHaveBeenCalledWith(
			['cycle', 'cycleItem', 'training'],
			'readwrite',
			expect.any(Function),
		);
		expect(written.cycle).toHaveLength(1);
		expect(written.training).toMatchObject([{ uuid: TRAINING, status: 'running' }]);
	});

	it('refuses to start while the set is still coming down', async () => {
		const { cycles } = configure([cycle(1, { expectedItems: 1000 })], set(600));

		await expect(cycles.startCycle(TRAINING)).rejects.toThrow(
			'The set is not fully replicated on this device',
		);
	});

	it('measures the set against the pass before, not the widest one', async () => {
		const { cycles } = configure(
			[cycle(1, { expectedItems: 1000 }), cycle(2, { expectedItems: 399 })],
			set(1000),
		);

		await expect(cycles.startCycle(TRAINING)).rejects.toThrow(
			'The set is not fully replicated on this device',
		);
	});

	it('starts over a pass before that says what the set says', async () => {
		const { cycles } = configure(
			[cycle(1, { expectedItems: 1 }), cycle(2, { expectedItems: 1000 })],
			set(1000),
		);

		await expect(cycles.startCycle(TRAINING)).resolves.toMatchObject({
			index: 3,
			expectedItems: 1000,
		});
	});

	it('takes the set as it is when no pass says what to expect', async () => {
		const { cycles } = configure([cycle(1)], set(4));

		await expect(cycles.startCycle(TRAINING)).resolves.toMatchObject({ expectedItems: 4 });
	});

	it('refuses an empty set before looking at any pass', async () => {
		const { cycles } = configure([cycle(1, { expectedItems: 1000 })], []);

		await expect(cycles.startCycle(TRAINING)).rejects.toThrow('The set is empty');
	});
});

function items(cycleUuid: string, size: number): CycleItemRow[] {
	return Array.from({ length: size }, (_unused, position) => ({
		uuid: `item-${position.toString()}`,
		cycleUuid,
		trainingPuzzleUuid: `set-${position.toString()}`,
		lichessId: `L${position.toString()}`,
		position,
		createdAt: new Date('2026-08-01T09:00:00.000Z'),
		updatedAt: new Date('2026-08-01T09:00:00.000Z'),
	}));
}

function played(slots: readonly CycleItemRow[]): Partial<AttemptRow>[] {
	return slots.map((slot) => ({
		uuid: `attempt-${slot.position.toString()}`,
		trainingUuid: TRAINING,
		kind: 'cycle' as const,
		cycleItemUuid: slot.uuid,
	}));
}

describe('LocalCycleUseCase.closeIfComplete', () => {
	beforeEach(() => {
		TestBed.resetTestingModule();
	});

	it('closes a pass whose every slot is here and played', async () => {
		const slots = items('cycle-1', 3);
		const { cycles, repository } = configure(
			[cycle(1, { status: 'running', expectedItems: 3 })],
			set(3),
			{ items: slots, attempts: played(slots) },
		);

		await expect(cycles.closeIfComplete(TRAINING, 'cycle-1')).resolves.toBe(true);
		expect(repository.insert).toHaveBeenCalledWith(
			'cycle',
			expect.objectContaining({ status: 'finished' }),
		);
	});

	it('does not close a pass missing slots on this device, however played the rest are', async () => {
		const slots = items('cycle-1', 2);
		const { cycles, repository } = configure(
			[cycle(1, { status: 'running', expectedItems: 3 })],
			set(3),
			{ items: slots, attempts: played(slots) },
		);

		await expect(cycles.closeIfComplete(TRAINING, 'cycle-1')).resolves.toBe(false);
		expect(repository.insert).not.toHaveBeenCalled();
	});

	it('does not close a pass with a slot nobody has played yet', async () => {
		const slots = items('cycle-1', 3);
		const { cycles } = configure([cycle(1, { status: 'running', expectedItems: 3 })], set(3), {
			items: slots,
			attempts: played(slots.slice(0, 2)),
		});

		await expect(cycles.closeIfComplete(TRAINING, 'cycle-1')).resolves.toBe(false);
	});
});

describe('LocalCycleUseCase.nextSlot', () => {
	beforeEach(() => {
		TestBed.resetTestingModule();
	});

	it('refuses to hand out an exercise from a pass missing slots', async () => {
		const slots = items('cycle-1', 2);
		const { cycles } = configure([cycle(1, { status: 'running', expectedItems: 3 })], set(3), {
			items: slots,
		});

		await expect(cycles.nextSlot(TRAINING)).rejects.toThrow(
			'The cycle is missing slots on this device and has to be repaired',
		);
	});

	it('says what to do about it, instead of leaving a generic failure behind', async () => {
		const slots = items('cycle-1', 2);
		const { cycles } = configure([cycle(1, { status: 'running', expectedItems: 3 })], set(3), {
			items: slots,
		});

		await expect(cycles.nextSlot(TRAINING)).rejects.toMatchObject({
			ref: { key: I18n.training.CYCLE_NEEDS_REPAIR },
		});
	});
});

describe('LocalCycleUseCase.declarePartial', () => {
	beforeEach(() => {
		TestBed.resetTestingModule();
	});

	const partial = (uuid: string, itemCount: number) => ({
		uuid,
		trainingUuid: TRAINING,
		index: 1,
		itemCount,
		storedItems: 1,
	});

	it('writes the size the server says a cycle should have, over the smaller one here', async () => {
		const { cycles, repository } = configure([cycle(1, { expectedItems: 399 })], set(1000));

		await expect(cycles.declarePartial([partial('cycle-1', 1000)])).resolves.toStrictEqual(1);
		expect(repository.insert).toHaveBeenCalledWith(
			'cycle',
			expect.objectContaining({ uuid: 'cycle-1', expectedItems: 1000 }),
		);
	});

	it('leaves the row alone when this device already expects at least as much', async () => {
		const { cycles, repository } = configure([cycle(1, { expectedItems: 1000 })], set(1000));

		await expect(cycles.declarePartial([partial('cycle-1', 399)])).resolves.toStrictEqual(0);
		expect(repository.insert).not.toHaveBeenCalled();
	});

	it('does not mark the row pending, because the number came from the server', async () => {
		const { cycles, repository } = configure([cycle(1, { expectedItems: 399 })], set(1000));

		await cycles.declarePartial([partial('cycle-1', 1000)]);

		expect(repository.insert).toHaveBeenCalledWith(
			'cycle',
			expect.not.objectContaining({ pendingSince: expect.anything() }),
		);
	});

	it('skips a cycle this device has never seen', async () => {
		const { cycles, repository } = configure([], set(1000));

		await expect(cycles.declarePartial([partial('cycle-9', 1000)])).resolves.toStrictEqual(0);
		expect(repository.insert).not.toHaveBeenCalled();
	});
});

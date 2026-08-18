import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
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

function configure(cycles: readonly TrainingCycleRow[], puzzles: readonly TrainingPuzzleRow[]) {
	const byStore: Record<string, readonly unknown[]> = { cycle: cycles, trainingPuzzle: puzzles };
	const repository = {
		findAllByIndex: vi.fn((store: string) => Promise.resolve(byStore[store] ?? [])),
		insert: vi.fn((_store: string, row: unknown) => Promise.resolve(row)),
		batchInsert: vi.fn().mockResolvedValue(undefined),
	};
	const trainings = {
		find: vi.fn().mockResolvedValue({ uuid: TRAINING, status: 'planning' }),
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

	return { repository, trainings, cycles: TestBed.inject(LocalCycleUseCase) };
}

describe('LocalCycleUseCase.startCycle', () => {
	beforeEach(() => {
		TestBed.resetTestingModule();
	});

	it('starts the first pass of a training that has none', async () => {
		const { cycles, repository } = configure([], set(3));

		const started = await cycles.startCycle(TRAINING);

		expect(started).toMatchObject({ index: 1, status: 'running', expectedItems: 3 });
		expect(repository.batchInsert).toHaveBeenCalledWith('cycleItem', expect.any(Array));
	});

	it('refuses to start while the set is still coming down', async () => {
		const { cycles } = configure([cycle(1, { expectedItems: 1000 })], set(600));

		await expect(cycles.startCycle(TRAINING)).rejects.toThrow(
			'The set is not fully replicated on this device',
		);
	});

	it('measures the set against the widest pass, not the last one', async () => {
		const { cycles } = configure(
			[cycle(1, { expectedItems: 1000 }), cycle(2, { expectedItems: 1 })],
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

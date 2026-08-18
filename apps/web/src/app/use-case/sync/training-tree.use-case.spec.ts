import { TestBed } from '@angular/core/testing';
import {
	IDBCursor,
	IDBDatabase,
	IDBFactory,
	IDBIndex,
	IDBKeyRange,
	IDBObjectStore,
	IDBRequest,
	IDBTransaction,
} from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';

import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import {
	CalibrationPuzzleRow,
	CalibrationRoundRow,
	CycleItemRow,
	TrainingCycleRow,
	TrainingGoalRow,
	TrainingPuzzleRow,
	TrainingRow,
} from '@app/repository/definition/training-schema.interface';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { SyncableRow, born, confirmed, rejected } from '@app/use-case/sync/local-record';
import { TrainingTreeUseCase } from '@app/use-case/sync/training-tree.use-case';

const TRAINING = 'training-1';

const CREATED = new Date('2026-08-01T09:00:00.000Z');

const UPDATED = new Date('2026-08-18T09:00:00.000Z');

const SYNCED = new Date('2026-08-18T09:15:00.000Z');

const REFUSED_AT = new Date('2026-08-18T09:20:00.000Z');

function sealed<T extends SyncableRow>(row: T): T {
	return confirmed(born(row), SYNCED);
}

function refused<T extends SyncableRow>(row: T): T {
	return rejected(born(row), REFUSED_AT, 'sync/unknown puzzle');
}

function training(uuid: string, over: Partial<TrainingRow> = {}): TrainingRow {
	return { uuid, status: 'running', createdAt: CREATED, updatedAt: UPDATED, ...over };
}

function goal(uuid: string, over: Partial<TrainingGoalRow> = {}): TrainingGoalRow {
	return {
		uuid,
		trainingUuid: TRAINING,
		puzzlesPerDay: 10,
		createdAt: CREATED,
		updatedAt: UPDATED,
		...over,
	};
}

function round(uuid: string, over: Partial<CalibrationRoundRow> = {}): CalibrationRoundRow {
	return {
		uuid,
		trainingUuid: TRAINING,
		index: 1,
		kind: 'scan',
		rating: 1500,
		outcome: 'raise',
		createdAt: CREATED,
		updatedAt: UPDATED,
		...over,
	};
}

function dealt(
	uuid: string,
	roundUuid: string,
	over: Partial<CalibrationPuzzleRow> = {},
): CalibrationPuzzleRow {
	return {
		uuid,
		roundUuid,
		lichessId: `L-${uuid}`,
		position: 0,
		createdAt: CREATED,
		updatedAt: UPDATED,
		...over,
	};
}

function exercise(uuid: string, over: Partial<TrainingPuzzleRow> = {}): TrainingPuzzleRow {
	return {
		uuid,
		trainingUuid: TRAINING,
		lichessId: `L-${uuid}`,
		rating: 1500,
		createdAt: CREATED,
		updatedAt: UPDATED,
		...over,
	};
}

function pass(uuid: string, over: Partial<TrainingCycleRow> = {}): TrainingCycleRow {
	return {
		uuid,
		trainingUuid: TRAINING,
		index: 1,
		status: 'running',
		createdAt: CREATED,
		updatedAt: UPDATED,
		...over,
	};
}

function slot(
	uuid: string,
	cycleUuid: string,
	trainingPuzzleUuid: string,
	over: Partial<CycleItemRow> = {},
): CycleItemRow {
	return {
		uuid,
		cycleUuid,
		trainingPuzzleUuid,
		lichessId: `L-${trainingPuzzleUuid}`,
		position: 0,
		createdAt: CREATED,
		updatedAt: UPDATED,
		...over,
	};
}

function attempt(uuid: string, over: Partial<AttemptRow> = {}): AttemptRow {
	return {
		uuid,
		trainingUuid: TRAINING,
		kind: 'cycle',
		puzzleUuid: 'puzzle-1',
		lichessId: 'L-1',
		durationMs: 4000,
		record: ['e2e4'],
		explorations: [],
		solved: true,
		closure: 'found',
		hintUsed: false,
		mistakeCount: 0,
		createdAt: CREATED,
		updatedAt: UPDATED,
		...over,
	};
}

const GOAL_FILL = SyncPolicy.pushBatchSize - 1;

async function fillBudget(repository: LocalDataRepository): Promise<void> {
	await repository.insert('training', born(training(TRAINING)));
	await repository.batchInsert(
		'trainingGoal',
		Array.from({ length: GOAL_FILL }, (_unused, index) =>
			born(goal(`goal-${index.toString().padStart(3, '0')}`)),
		),
	);
}

function configure() {
	Object.assign(globalThis, {
		indexedDB: new IDBFactory(),
		IDBCursor,
		IDBDatabase,
		IDBIndex,
		IDBKeyRange,
		IDBObjectStore,
		IDBRequest,
		IDBTransaction,
	});

	TestBed.resetTestingModule();
	TestBed.configureTestingModule({});

	return {
		repository: TestBed.inject(LocalDataRepository),
		trees: TestBed.inject(TrainingTreeUseCase),
	};
}

describe('TrainingTreeUseCase.listPending', () => {
	let repository: LocalDataRepository;
	let trees: TrainingTreeUseCase;

	beforeEach(async () => {
		({ repository, trees } = configure());

		await repository.insert('training', sealed(training(TRAINING)));
	});

	it('names the training a waiting row hangs from', async () => {
		await repository.insert('trainingGoal', born(goal('goal-1')));

		await expect(trees.listPending()).resolves.toEqual([TRAINING]);
	});

	it('reaches the training through the round a dealt puzzle hangs from', async () => {
		await repository.insert('calibrationRound', sealed(round('round-1')));
		await repository.insert('calibrationPuzzle', born(dealt('dealt-1', 'round-1')));

		await expect(trees.listPending()).resolves.toEqual([TRAINING]);
	});

	it('reaches the training through the pass a slot hangs from', async () => {
		await repository.insert('cycle', sealed(pass('cycle-1')));
		await repository.insert('cycleItem', born(slot('item-1', 'cycle-1', 'set-1')));

		await expect(trees.listPending()).resolves.toEqual([TRAINING]);
	});

	it('names a training once however many of its rows are waiting', async () => {
		await repository.insert('trainingGoal', born(goal('goal-1')));
		await repository.insert('trainingPuzzle', born(exercise('set-1')));
		await repository.insert('attempt', born(attempt('attempt-1')));

		await expect(trees.listPending()).resolves.toEqual([TRAINING]);
	});

	it('lists nothing when every row is already up', async () => {
		await repository.insert('trainingGoal', sealed(goal('goal-1')));
		await repository.insert('trainingPuzzle', sealed(exercise('set-1')));

		await expect(trees.listPending()).resolves.toEqual([]);
	});
});

describe('TrainingTreeUseCase.build', () => {
	let repository: LocalDataRepository;
	let trees: TrainingTreeUseCase;

	beforeEach(() => {
		({ repository, trees } = configure());
	});

	it('hangs every branch off the training, parents before children', async () => {
		await repository.insert('training', born(training(TRAINING)));
		await repository.insert('trainingGoal', born(goal('goal-1')));
		await repository.insert('calibrationRound', born(round('round-1')));
		await repository.insert('calibrationPuzzle', born(dealt('dealt-1', 'round-1')));
		await repository.insert('trainingPuzzle', born(exercise('set-1')));
		await repository.insert('cycle', born(pass('cycle-1')));
		await repository.insert('cycleItem', born(slot('item-1', 'cycle-1', 'set-1')));
		await repository.insert(
			'attempt',
			born(attempt('attempt-1', { kind: 'calibration', roundUuid: 'round-1' })),
		);
		await repository.insert('attempt', born(attempt('attempt-2', { cycleItemUuid: 'item-1' })));

		const push = await trees.build(TRAINING);

		expect(push?.request.training).toMatchObject({
			clientRef: TRAINING,
			status: 'running',
			goals: [{ clientRef: 'goal-1', puzzlesPerDay: 10 }],
			rounds: [
				{
					clientRef: 'round-1',
					puzzles: [{ clientRef: 'dealt-1' }],
					attempts: [{ clientRef: 'attempt-1' }],
				},
			],
			puzzles: [{ clientRef: 'set-1' }],
			cycles: [
				{
					clientRef: 'cycle-1',
					items: [{ clientRef: 'item-1', attempts: [{ clientRef: 'attempt-2' }] }],
				},
			],
		});
		expect(push?.manifest).toEqual({
			training: [TRAINING],
			trainingGoal: ['goal-1'],
			calibrationRound: ['round-1'],
			calibrationPuzzle: ['dealt-1'],
			trainingPuzzle: ['set-1'],
			cycle: ['cycle-1'],
			cycleItem: ['item-1'],
			attempt: ['attempt-1', 'attempt-2'],
		});
	});

	it('names a slot after the exercise of the set it points at', async () => {
		await repository.insert('training', sealed(training(TRAINING)));
		await repository.insert('trainingPuzzle', born(exercise('set-1')));
		await repository.insert('cycle', sealed(pass('cycle-1')));
		await repository.insert('cycleItem', born(slot('item-1', 'cycle-1', 'set-1')));

		const push = await trees.build(TRAINING);

		expect(push?.request.training.cycles[0]?.items[0]).toMatchObject({
			trainingPuzzleRef: 'set-1',
		});
	});

	it('leaves out a slot whose exercise of the set is not here', async () => {
		await repository.insert('training', sealed(training(TRAINING)));
		await repository.insert('cycle', born(pass('cycle-1')));
		await repository.insert('cycleItem', born(slot('item-1', 'cycle-1', 'gone')));

		const push = await trees.build(TRAINING);

		expect(push?.request.training.cycles[0]?.items).toEqual([]);
		expect(push?.manifest.cycleItem).toEqual([]);
	});

	it('leaves out a branch the server already refused', async () => {
		await repository.insert('training', sealed(training(TRAINING)));
		await repository.insert('trainingGoal', refused(goal('goal-1')));
		await repository.insert('trainingPuzzle', born(exercise('set-1')));

		const push = await trees.build(TRAINING);

		expect(push?.request.training.goals).toEqual([]);
		expect(push?.manifest.trainingGoal).toEqual([]);
	});

	it('builds nothing when the tree has nothing waiting', async () => {
		await repository.insert('training', sealed(training(TRAINING)));
		await repository.insert('trainingGoal', sealed(goal('goal-1')));

		await expect(trees.build(TRAINING)).resolves.toBeUndefined();
	});

	it('builds nothing for a training the server refused', async () => {
		await repository.insert('training', refused(training(TRAINING)));
		await repository.insert('trainingGoal', born(goal('goal-1')));

		await expect(trees.build(TRAINING)).resolves.toBeUndefined();
	});

	describe('when the budget runs out', () => {
		it('spends it on what comes first and stops there', async () => {
			await fillBudget(repository);
			await repository.insert('trainingPuzzle', born(exercise('set-1')));

			const push = await trees.build(TRAINING);

			expect(push?.request.training.goals).toHaveLength(GOAL_FILL);
			expect(push?.manifest.trainingPuzzle).toEqual([]);
			expect(push?.request.training.puzzles).toEqual([]);
		});

		it('does not send a child whose parent did not fit', async () => {
			await fillBudget(repository);
			await repository.insert('calibrationRound', born(round('round-1')));
			await repository.insert('calibrationPuzzle', born(dealt('dealt-1', 'round-1')));

			const push = await trees.build(TRAINING);

			expect(push?.request.training.rounds).toEqual([]);
			expect(push?.manifest.calibrationRound).toEqual([]);
			expect(push?.manifest.calibrationPuzzle).toEqual([]);
		});

		it('still sends a parent that is already up, so its children have a name', async () => {
			await fillBudget(repository);
			await repository.insert('calibrationRound', sealed(round('round-1')));
			await repository.insert('calibrationPuzzle', born(dealt('dealt-1', 'round-1')));

			const push = await trees.build(TRAINING);

			expect(push?.request.training.rounds).toHaveLength(1);
			expect(push?.request.training.rounds[0]?.puzzles).toEqual([]);
			expect(push?.manifest.calibrationPuzzle).toEqual([]);
		});
	});
});

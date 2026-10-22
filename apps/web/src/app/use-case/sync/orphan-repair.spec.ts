import { TestBed } from '@angular/core/testing';
import type {
	PushTrainingRequest,
	PushTrainingResult,
	SyncNode,
} from '@chesspecker/api-definitions';
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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttemptDraftRow } from '@app/repository/definition/attempt-draft-schema.interface';
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
import { SyncRepository } from '@app/repository/sync.repository';
import { SyncableRow, born, confirmed } from '@app/use-case/sync/local-record';
import { SyncPushUseCase } from '@app/use-case/sync/sync-push.use-case';

const TRAINING = 'training-1';

const ROUND = 'round-1';

const CYCLE = 'cycle-1';

const CREATED = new Date('2026-08-01T09:00:00.000Z');

const UPDATED = new Date('2026-08-18T09:00:00.000Z');

const SYNCED = new Date('2026-08-18T09:30:00.000Z');

const RECEIVED_AT = '2026-08-18T10:00:00.000Z';

function server(uuid: string): string {
	return `server-${uuid}`;
}

function upstream<T extends SyncableRow>(row: T): T {
	return confirmed<T>({ ...row, uuid: server(row.uuid), clientRef: row.uuid }, SYNCED);
}

function training(): TrainingRow {
	return upstream<TrainingRow>({
		uuid: TRAINING,
		status: 'running',
		createdAt: CREATED,
		updatedAt: UPDATED,
	});
}

function goal(uuid: string, trainingUuid: string): TrainingGoalRow {
	return { uuid, trainingUuid, puzzlesPerDay: 10, createdAt: CREATED, updatedAt: UPDATED };
}

function round(uuid: string, trainingUuid: string): CalibrationRoundRow {
	return {
		uuid,
		trainingUuid,
		index: 5,
		kind: 'refine',
		rating: 1500,
		outcome: 'pending',
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function dealt(uuid: string, roundUuid: string): CalibrationPuzzleRow {
	return { uuid, roundUuid, lichessId: 'L1', position: 0, createdAt: CREATED, updatedAt: UPDATED };
}

function exercise(uuid: string, trainingUuid: string): TrainingPuzzleRow {
	return {
		uuid,
		trainingUuid,
		lichessId: 'L1',
		rating: 1500,
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function pass(uuid: string, trainingUuid: string): TrainingCycleRow {
	return {
		uuid,
		trainingUuid,
		index: 1,
		status: 'running',
		expectedItems: 1,
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function slot(uuid: string, cycleUuid: string, trainingPuzzleUuid: string): CycleItemRow {
	return {
		uuid,
		cycleUuid,
		trainingPuzzleUuid,
		lichessId: 'L1',
		position: 0,
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function attempt(uuid: string, over: Partial<AttemptRow> = {}): AttemptRow {
	return {
		uuid,
		trainingUuid: server(TRAINING),
		kind: 'cycle',
		puzzleUuid: 'puzzle-L1',
		lichessId: 'L1',
		durationMs: 4000,
		record: ['d1d8'],
		freePlayRuns: [],
		solved: true,
		closure: 'found',
		hintUsed: false,
		mistakeCount: 0,
		createdAt: CREATED,
		updatedAt: UPDATED,
		...over,
	};
}

function draft(slotId: string, over: Partial<AttemptDraftRow> = {}): AttemptDraftRow {
	return {
		slotId,
		uuid: 'draft-attempt',
		trainingUuid: server(TRAINING),
		kind: 'cycle',
		puzzleUuid: 'puzzle-L1',
		lichessId: 'L1',
		durationMs: 1200,
		record: ['d1d8'],
		freePlayRuns: [],
		hintUsed: false,
		mistakeCount: 0,
		createdAt: CREATED,
		updatedAt: UPDATED,
		...over,
	};
}

function answer(): PushTrainingResult {
	return {
		receivedAt: RECEIVED_AT,
		uuids: {
			training: {},
			trainingGoal: {},
			calibrationRound: {},
			calibrationPuzzle: {},
			trainingPuzzle: {},
			cycle: {},
			cycleItem: {},
			attempt: {},
		},
		rejected: [],
	};
}

function refOf(node: SyncNode): string {
	return node.clientRef ?? node.uuid ?? '';
}

function sentAttempts(sent: readonly PushTrainingRequest[]): string[] {
	return sent
		.flatMap(({ training: tree }) => [
			...tree.rounds.flatMap((node) => node.attempts),
			...tree.cycles.flatMap((node) => node.items.flatMap((item) => item.attempts)),
		])
		.map((node) => refOf(node));
}

function sentGoals(sent: readonly PushTrainingRequest[]): string[] {
	return sent.flatMap(({ training: tree }) => tree.goals.map((node) => refOf(node)));
}

function sentRounds(sent: readonly PushTrainingRequest[]): string[] {
	return sent.flatMap(({ training: tree }) => tree.rounds.map((node) => refOf(node)));
}

async function seedRound(repository: LocalDataRepository): Promise<void> {
	await repository.insert('training', training());
	await repository.insert('calibrationRound', upstream(round(ROUND, server(TRAINING))));
	await repository.insert('calibrationPuzzle', upstream(dealt('dealt-1', server(ROUND))));
}

async function seedCycle(repository: LocalDataRepository): Promise<void> {
	await repository.insert('training', training());
	await repository.insert('trainingPuzzle', upstream(exercise('set-1', server(TRAINING))));
	await repository.insert('cycle', upstream(pass(CYCLE, server(TRAINING))));
	await repository.insert('cycleItem', upstream(slot('item-1', server(CYCLE), server('set-1'))));
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

	const sent: PushTrainingRequest[] = [];
	const remote = {
		pushTraining: vi.fn((request: PushTrainingRequest) => {
			sent.push(request);

			return Promise.resolve(answer());
		}),
	};

	TestBed.resetTestingModule();
	TestBed.configureTestingModule({ providers: [{ provide: SyncRepository, useValue: remote }] });

	return {
		sent,
		repository: TestBed.inject(LocalDataRepository),
		push: TestBed.inject(SyncPushUseCase),
	};
}

describe('SyncPushUseCase, on rows that still name a parent by its old uuid', () => {
	let sent: PushTrainingRequest[];
	let repository: LocalDataRepository;
	let push: SyncPushUseCase;

	beforeEach(() => {
		({ sent, repository, push } = configure());
	});

	it('reattaches an attempt whose round is now known by its clientRef', async () => {
		await seedRound(repository);
		await repository.insert(
			'attempt',
			born(attempt('attempt-2', { kind: 'calibration', roundUuid: ROUND })),
		);

		await push.execute();

		expect(sentAttempts(sent)).toEqual(['attempt-2']);
		await expect(repository.find('attempt', 'attempt-2')).resolves.toMatchObject({
			roundUuid: server(ROUND),
		});
	});

	it('reattaches an attempt whose slot is now known by its clientRef', async () => {
		await seedCycle(repository);
		await repository.insert('attempt', born(attempt('attempt-2', { cycleItemUuid: 'item-1' })));

		await push.execute();

		expect(sentAttempts(sent)).toEqual(['attempt-2']);
		await expect(repository.find('attempt', 'attempt-2')).resolves.toMatchObject({
			cycleItemUuid: server('item-1'),
		});
	});

	it('reattaches the goal and the round that still name the training by its old uuid', async () => {
		await repository.insert('training', training());
		await repository.insert('trainingGoal', born(goal('goal-9', TRAINING)));
		await repository.insert('calibrationRound', born(round('round-9', TRAINING)));
		await repository.insert('calibrationPuzzle', born(dealt('dealt-9', 'round-9')));

		await push.execute();

		expect(sentGoals(sent)).toEqual(['goal-9']);
		expect(sentRounds(sent)).toEqual(['round-9']);
	});

	it('refuses with its reason an orphan whose slot was played again', async () => {
		await seedCycle(repository);
		await repository.insert(
			'attempt',
			upstream(attempt('attempt-3', { cycleItemUuid: server('item-1') })),
		);
		await repository.insert('attempt', born(attempt('attempt-2', { cycleItemUuid: 'item-1' })));

		await push.execute();

		const orphan = await repository.find('attempt', 'attempt-2');

		expect(sentAttempts(sent)).toEqual([]);
		expect(orphan?.rejectedAt).toBeInstanceOf(Date);
		expect(orphan?.rejectedReason).toEqual(expect.any(String));
		expect(orphan?.pendingSince).toBeUndefined();
	});

	it('moves an orphan draft to the slot it belongs to', async () => {
		await seedCycle(repository);
		await repository.insert('attemptDraft', draft('item-1', { cycleItemUuid: 'item-1' }));

		await push.execute();

		await expect(repository.findAll('attemptDraft')).resolves.toMatchObject([
			{ slotId: server('item-1'), cycleItemUuid: server('item-1') },
		]);
	});

	it('drops an orphan draft whose slot is already closed', async () => {
		await seedCycle(repository);
		await repository.insert(
			'attempt',
			upstream(attempt('attempt-3', { cycleItemUuid: server('item-1') })),
		);
		await repository.insert('attemptDraft', draft('item-1', { cycleItemUuid: 'item-1' }));

		await push.execute();

		await expect(repository.findAll('attemptDraft')).resolves.toEqual([]);
	});

	it('leaves alone a row whose parent nobody holds', async () => {
		await seedRound(repository);
		await repository.insert(
			'attempt',
			born(attempt('attempt-2', { kind: 'calibration', roundUuid: 'nobody' })),
		);

		await push.execute();

		const orphan = await repository.find('attempt', 'attempt-2');

		expect(orphan).toMatchObject({ roundUuid: 'nobody', pendingSince: UPDATED });
		expect(orphan?.rejectedAt).toBeUndefined();
	});
});

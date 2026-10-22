import { TestBed } from '@angular/core/testing';
import type { PushTrainingResult, SyncEntity, SyncRejection } from '@chesspecker/api-definitions';
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

import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import {
	CalibrationRoundRow,
	TrainingGoalRow,
	TrainingRow,
} from '@app/repository/definition/training-schema.interface';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { born, rejected, touch } from '@app/use-case/sync/local-record';
import { SyncConfirmUseCase } from '@app/use-case/sync/sync-confirm.use-case';
import { SyncManifest } from '@app/use-case/sync/sync-manifest';
import { TrainingTreePush, TrainingTreeUseCase } from '@app/use-case/sync/training-tree.use-case';

const TRAINING = 'training-1';

const SERVER_TRAINING = 'server-training';

const CREATED = new Date('2026-08-01T09:00:00.000Z');

const UPDATED = new Date('2026-08-18T09:00:00.000Z');

const RECEIVED_AT = '2026-08-18T10:00:00.000Z';

const REFUSED_EARLIER = new Date('2026-08-17T10:00:00.000Z');

const FINISHED = new Date('2026-08-18T09:30:00.000Z');

function training(uuid: string, over: Partial<TrainingRow> = {}): TrainingRow {
	return { uuid, status: 'running', createdAt: CREATED, updatedAt: UPDATED, ...over };
}

function goal(uuid: string): TrainingGoalRow {
	return {
		uuid,
		trainingUuid: TRAINING,
		puzzlesPerDay: 10,
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function round(uuid: string): CalibrationRoundRow {
	return {
		uuid,
		trainingUuid: TRAINING,
		index: 1,
		kind: 'exploration',
		rating: 1500,
		outcome: 'raise',
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function attempt(uuid: string): AttemptRow {
	return {
		uuid,
		trainingUuid: TRAINING,
		kind: 'cycle',
		puzzleUuid: 'puzzle-1',
		lichessId: 'L-1',
		durationMs: 4000,
		record: ['e2e4'],
		freePlayRuns: [],
		solved: true,
		closure: 'found',
		hintUsed: false,
		mistakeCount: 0,
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function emptyManifest(): SyncManifest {
	return {
		training: new Map(),
		trainingGoal: new Map(),
		calibrationRound: new Map(),
		calibrationPuzzle: new Map(),
		trainingPuzzle: new Map(),
		cycle: new Map(),
		cycleItem: new Map(),
		attempt: new Map(),
	};
}

function sentAsStored(over: Partial<Record<SyncEntity, readonly string[]>>): Partial<SyncManifest> {
	return Object.fromEntries(
		Object.entries(over).map(([entity, uuids]) => [
			entity,
			new Map(uuids.map((uuid) => [uuid, UPDATED.getTime()])),
		]),
	);
}

function promising(over: Partial<Record<SyncEntity, readonly string[]>> = {}): TrainingTreePush {
	return {
		trainingUuid: TRAINING,
		request: {
			training: {
				clientRef: TRAINING,
				status: 'running',
				goals: [],
				rounds: [],
				puzzles: [],
				cycles: [],
			},
		},
		manifest: { ...emptyManifest(), ...sentAsStored(over) },
	};
}

function assigned(
	over: Partial<Record<SyncEntity, Record<string, string>>> = {},
): PushTrainingResult['uuids'] {
	return {
		training: {},
		trainingGoal: {},
		calibrationRound: {},
		calibrationPuzzle: {},
		trainingPuzzle: {},
		cycle: {},
		cycleItem: {},
		attempt: {},
		...over,
	};
}

function answer(
	uuids: PushTrainingResult['uuids'] = assigned(),
	refusals: readonly SyncRejection[] = [],
): PushTrainingResult {
	return { receivedAt: RECEIVED_AT, uuids, rejected: refusals };
}

async function inFlight(trees: TrainingTreeUseCase): Promise<TrainingTreePush> {
	const push = await trees.build(TRAINING);

	if (undefined === push) {
		throw new Error('The tree had nothing to push');
	}

	return push;
}

async function finishMeanwhile(repository: LocalDataRepository): Promise<void> {
	const stored = await repository.find('training', TRAINING);

	if (undefined === stored) {
		throw new Error('The training is not on this device');
	}

	await repository.insert(
		'training',
		touch<TrainingRow>(
			{ ...stored, status: 'finished', finishedReason: 'completed', finishedAt: FINISHED },
			FINISHED,
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
		confirms: TestBed.inject(SyncConfirmUseCase),
	};
}

describe('SyncConfirmUseCase.execute', () => {
	let repository: LocalDataRepository;
	let confirms: SyncConfirmUseCase;

	beforeEach(() => {
		({ repository, confirms } = configure());
	});

	it('seals the row under the uuid the rekey left it in', async () => {
		await repository.insert('training', born(training(SERVER_TRAINING)));

		await confirms.execute(
			promising({ training: [TRAINING] }),
			answer(assigned({ training: { [TRAINING]: SERVER_TRAINING } })),
		);

		const row = await repository.find('training', SERVER_TRAINING);

		expect(row?.syncedAt).toEqual(new Date(RECEIVED_AT));
		expect(row?.pendingSince).toBeUndefined();
	});

	it('seals under its own uuid when the server kept the one it was born with', async () => {
		await repository.insert('trainingGoal', born(goal('goal-1')));

		await confirms.execute(promising({ trainingGoal: ['goal-1'] }), answer());

		const row = await repository.find('trainingGoal', 'goal-1');

		expect(row?.syncedAt).toEqual(new Date(RECEIVED_AT));
		expect(row?.pendingSince).toBeUndefined();
	});

	it('does not refresh `updatedAt` when it seals', async () => {
		await repository.insert('trainingGoal', born(goal('goal-1')));

		await confirms.execute(promising({ trainingGoal: ['goal-1'] }), answer());

		await expect(repository.find('trainingGoal', 'goal-1')).resolves.toMatchObject({
			updatedAt: UPDATED,
			clientRef: 'goal-1',
		});
	});

	it('clears an earlier motive when the row finally enters', async () => {
		await repository.insert(
			'trainingGoal',
			rejected(born(goal('goal-1')), REFUSED_EARLIER, 'sync/unknown puzzle'),
		);

		await confirms.execute(promising({ trainingGoal: ['goal-1'] }), answer());

		const row = await repository.find('trainingGoal', 'goal-1');

		expect(row?.rejectedAt).toBeUndefined();
		expect(row?.rejectedReason).toBeUndefined();
	});

	it('marks a refused row with its motive, under the uuid it kept', async () => {
		await repository.insert('trainingGoal', born(goal('goal-1')));

		await confirms.execute(
			promising({ trainingGoal: ['goal-1'] }),
			answer(assigned(), [
				{ entity: 'trainingGoal', clientRef: 'goal-1', reason: 'sync/unknown puzzle' },
			]),
		);

		const row = await repository.find('trainingGoal', 'goal-1');

		expect(row?.rejectedAt).toEqual(new Date(RECEIVED_AT));
		expect(row?.rejectedReason).toEqual('sync/unknown puzzle');
		expect(row?.pendingSince).toBeUndefined();
		expect(row?.syncedAt).toBeUndefined();
	});

	it('does not read the motive of another table as its own', async () => {
		await repository.insert('trainingGoal', born(goal('shared-uuid')));

		await confirms.execute(
			promising({ trainingGoal: ['shared-uuid'] }),
			answer(assigned(), [
				{ entity: 'calibrationRound', clientRef: 'shared-uuid', reason: 'sync/refused' },
			]),
		);

		await expect(repository.find('trainingGoal', 'shared-uuid')).resolves.toMatchObject({
			syncedAt: new Date(RECEIVED_AT),
		});
	});

	it('leaves alone a waiting row the manifest did not promise', async () => {
		await repository.insert('trainingGoal', born(goal('goal-1')));
		await repository.insert('trainingGoal', born(goal('goal-2')));

		await confirms.execute(promising({ trainingGoal: ['goal-1'] }), answer());

		const row = await repository.find('trainingGoal', 'goal-2');

		expect(row?.pendingSince).toEqual(UPDATED);
		expect(row?.syncedAt).toBeUndefined();
	});

	it('counts what it sealed and what it refused', async () => {
		await repository.insert('training', born(training(TRAINING)));
		await repository.insert('trainingGoal', born(goal('goal-1')));
		await repository.insert('calibrationRound', born(round('round-1')));
		await repository.insert('attempt', born(attempt('attempt-1')));

		const settled = await confirms.execute(
			promising({
				training: [TRAINING],
				trainingGoal: ['goal-1'],
				calibrationRound: ['round-1'],
				attempt: ['attempt-1'],
			}),
			answer(assigned(), [
				{ entity: 'calibrationRound', clientRef: 'round-1', reason: 'sync/refused' },
			]),
		);

		expect(settled).toEqual({ confirmed: 3, rejected: 1 });
	});

	it('counts nothing for a row another tab took away while the push travelled', async () => {
		await repository.insert('trainingGoal', born(goal('goal-1')));

		const settled = await confirms.execute(
			promising({ trainingGoal: ['goal-1', 'gone'] }),
			answer(),
		);

		expect(settled).toEqual({ confirmed: 1, rejected: 0 });
	});

	it('seals nothing when the manifest promised nothing', async () => {
		await repository.insert('trainingGoal', born(goal('goal-1')));

		await expect(confirms.execute(promising(), answer())).resolves.toEqual({
			confirmed: 0,
			rejected: 0,
		});
		await expect(repository.find('trainingGoal', 'goal-1')).resolves.toMatchObject({
			pendingSince: UPDATED,
		});
	});
});

describe('SyncConfirmUseCase.rejectAll', () => {
	let repository: LocalDataRepository;
	let confirms: SyncConfirmUseCase;

	beforeEach(() => {
		({ repository, confirms } = configure());
	});

	it('marks every row the manifest promised with the same motive', async () => {
		await repository.insert('training', born(training(TRAINING)));
		await repository.insert('trainingGoal', born(goal('goal-1')));

		const settled = await confirms.rejectAll(
			promising({ training: [TRAINING], trainingGoal: ['goal-1'] }),
			'sync/bad request',
		);

		expect(settled).toEqual({ confirmed: 0, rejected: 2 });

		const row = await repository.find('trainingGoal', 'goal-1');

		expect(row?.rejectedReason).toEqual('sync/bad request');
		expect(row?.rejectedAt).toBeInstanceOf(Date);
		expect(row?.pendingSince).toBeUndefined();
	});

	it('leaves a waiting row outside the manifest waiting', async () => {
		await repository.insert('trainingGoal', born(goal('goal-1')));
		await repository.insert('trainingGoal', born(goal('goal-2')));

		await confirms.rejectAll(promising({ trainingGoal: ['goal-1'] }), 'sync/bad request');

		await expect(repository.find('trainingGoal', 'goal-2')).resolves.toMatchObject({
			pendingSince: UPDATED,
		});
	});

	it('counts only the rows it found', async () => {
		await repository.insert('trainingGoal', born(goal('goal-1')));

		await expect(
			confirms.rejectAll(promising({ trainingGoal: ['goal-1', 'gone'] }), 'sync/bad request'),
		).resolves.toEqual({ confirmed: 0, rejected: 1 });
	});
});

describe('SyncConfirmUseCase on a row that changed while its push travelled', () => {
	let repository: LocalDataRepository;
	let confirms: SyncConfirmUseCase;
	let trees: TrainingTreeUseCase;

	beforeEach(async () => {
		({ repository, confirms } = configure());
		trees = TestBed.inject(TrainingTreeUseCase);

		await repository.insert('training', born(training(TRAINING)));
	});

	it('keeps waiting a row that changed while its push travelled', async () => {
		const push = await inFlight(trees);

		await finishMeanwhile(repository);
		await confirms.execute(push, answer());

		const row = await repository.find('training', TRAINING);

		expect(row?.syncedAt).toEqual(new Date(RECEIVED_AT));
		expect(row?.pendingSince).toEqual(UPDATED);
	});

	it('does not refuse a row that changed while a refused push travelled', async () => {
		const push = await inFlight(trees);

		await finishMeanwhile(repository);
		await confirms.rejectAll(push, 'sync/bad request');

		const row = await repository.find('training', TRAINING);

		expect(row?.rejectedAt).toBeUndefined();
		expect(row?.pendingSince).toEqual(UPDATED);
	});

	it('does not refuse a row that changed while its own refusal travelled', async () => {
		const push = await inFlight(trees);

		await finishMeanwhile(repository);
		await confirms.execute(
			push,
			answer(assigned(), [{ entity: 'training', clientRef: TRAINING, reason: 'sync/refused' }]),
		);

		const row = await repository.find('training', TRAINING);

		expect(row?.rejectedAt).toBeUndefined();
		expect(row?.pendingSince).toEqual(UPDATED);
	});

	it('seals whole a row that did not change', async () => {
		const push = await inFlight(trees);

		await confirms.execute(push, answer());

		const row = await repository.find('training', TRAINING);

		expect(row?.syncedAt).toEqual(new Date(RECEIVED_AT));
		expect(row?.pendingSince).toBeUndefined();
	});

	it('sends again in the next push what changed in flight', async () => {
		const push = await inFlight(trees);

		await finishMeanwhile(repository);
		await confirms.execute(push, answer());

		await expect(trees.build(TRAINING)).resolves.toMatchObject({
			request: { training: { status: 'finished' } },
		});
	});
});

import { TestBed } from '@angular/core/testing';
import type { PushTrainingResult, SyncEntity } from '@chesspecker/api-definitions';
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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
import { born } from '@app/use-case/sync/local-record';
import { RekeyUseCase } from '@app/use-case/sync/rekey.use-case';

const TRAINING = 'training-1';

const PUZZLE = 'puzzle-1';

const CREATED = new Date('2026-08-01T09:00:00.000Z');

const UPDATED = new Date('2026-08-18T09:00:00.000Z');

const SERVER = {
	training: 'server-training',
	goal: 'server-goal',
	round: 'server-round',
	dealt: 'server-dealt',
	set: 'server-set',
	cycle: 'server-cycle',
	item: 'server-item',
	calibrationAttempt: 'server-attempt-1',
	cycleAttempt: 'server-attempt-2',
} as const;

const LOCAL_KEYS = new Set([
	TRAINING,
	'goal-1',
	'round-1',
	'dealt-1',
	'set-1',
	'cycle-1',
	'item-1',
	'attempt-1',
	'attempt-2',
]);

type ObjectStore = typeof IDBObjectStore.prototype;

type Put = typeof IDBObjectStore.prototype.put;

const REAL_PUT: Put = IDBObjectStore.prototype.put;

function training(uuid: string, over: Partial<TrainingRow> = {}): TrainingRow {
	return { uuid, status: 'running', createdAt: CREATED, updatedAt: UPDATED, ...over };
}

function goal(uuid: string, trainingUuid = TRAINING): TrainingGoalRow {
	return { uuid, trainingUuid, puzzlesPerDay: 10, createdAt: CREATED, updatedAt: UPDATED };
}

function round(uuid: string, trainingUuid = TRAINING): CalibrationRoundRow {
	return {
		uuid,
		trainingUuid,
		index: 1,
		kind: 'exploration',
		rating: 1500,
		outcome: 'raise',
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function dealt(uuid: string, roundUuid: string): CalibrationPuzzleRow {
	return {
		uuid,
		roundUuid,
		lichessId: `L-${uuid}`,
		position: 0,
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function exercise(uuid: string, trainingUuid = TRAINING): TrainingPuzzleRow {
	return {
		uuid,
		trainingUuid,
		lichessId: `L-${uuid}`,
		rating: 1500,
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function pass(uuid: string, trainingUuid = TRAINING): TrainingCycleRow {
	return {
		uuid,
		trainingUuid,
		index: 1,
		status: 'running',
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function slot(uuid: string, cycleUuid: string, trainingPuzzleUuid: string): CycleItemRow {
	return {
		uuid,
		cycleUuid,
		trainingPuzzleUuid,
		lichessId: `L-${trainingPuzzleUuid}`,
		position: 0,
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function attempt(uuid: string, over: Partial<AttemptRow> = {}): AttemptRow {
	return {
		uuid,
		trainingUuid: TRAINING,
		kind: 'cycle',
		puzzleUuid: PUZZLE,
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
		...over,
	};
}

function draft(slotId: string, over: Partial<AttemptDraftRow> = {}): AttemptDraftRow {
	return {
		slotId,
		uuid: 'draft-attempt',
		trainingUuid: TRAINING,
		kind: 'cycle',
		puzzleUuid: PUZZLE,
		lichessId: 'L-1',
		durationMs: 1200,
		record: ['e2e4'],
		freePlayRuns: [],
		hintUsed: false,
		mistakeCount: 0,
		createdAt: CREATED,
		updatedAt: UPDATED,
		...over,
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

function wholeTree(): PushTrainingResult['uuids'] {
	return assigned({
		training: { [TRAINING]: SERVER.training },
		trainingGoal: { 'goal-1': SERVER.goal },
		calibrationRound: { 'round-1': SERVER.round },
		calibrationPuzzle: { 'dealt-1': SERVER.dealt },
		trainingPuzzle: { 'set-1': SERVER.set },
		cycle: { 'cycle-1': SERVER.cycle },
		cycleItem: { 'item-1': SERVER.item },
		attempt: { 'attempt-1': SERVER.calibrationAttempt, 'attempt-2': SERVER.cycleAttempt },
	});
}

async function seedTree(repository: LocalDataRepository): Promise<void> {
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
}

async function keys(repository: LocalDataRepository): Promise<string[]> {
	const tables = await Promise.all([
		repository.findAll('training'),
		repository.findAll('trainingGoal'),
		repository.findAll('calibrationRound'),
		repository.findAll('calibrationPuzzle'),
		repository.findAll('trainingPuzzle'),
		repository.findAll('cycle'),
		repository.findAll('cycleItem'),
		repository.findAll('attempt'),
	]);

	return tables.flat().map((row) => row.uuid);
}

async function references(repository: LocalDataRepository): Promise<string[]> {
	const [goals, rounds, puzzles, exercises, cycles, items, attempts, drafts] = await Promise.all([
		repository.findAll('trainingGoal'),
		repository.findAll('calibrationRound'),
		repository.findAll('calibrationPuzzle'),
		repository.findAll('trainingPuzzle'),
		repository.findAll('cycle'),
		repository.findAll('cycleItem'),
		repository.findAll('attempt'),
		repository.findAll('attemptDraft'),
	]);

	return [
		...goals.map((row) => row.trainingUuid),
		...rounds.map((row) => row.trainingUuid),
		...puzzles.map((row) => row.roundUuid),
		...exercises.map((row) => row.trainingUuid),
		...cycles.map((row) => row.trainingUuid),
		...items.flatMap((row) => [row.cycleUuid, row.trainingPuzzleUuid]),
		...attempts.flatMap((row) => [row.trainingUuid, row.roundUuid, row.cycleItemUuid]),
		...drafts.flatMap((row) => [row.slotId, row.trainingUuid, row.roundUuid, row.cycleItemUuid]),
	].filter((reference): reference is string => undefined !== reference);
}

function isKeyed(value: unknown): value is { readonly uuid: string } {
	return 'object' === typeof value && null !== value && 'uuid' in value;
}

function failWriting(uuid: string): void {
	IDBObjectStore.prototype.put = function (
		this: ObjectStore,
		value: unknown,
		key?: IDBValidKey,
	): ReturnType<Put> {
		if (isKeyed(value) && uuid === value.uuid) {
			throw new DOMException('the disk is full', 'QuotaExceededError');
		}

		return REAL_PUT.call(this, value, key);
	};
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
		rekey: TestBed.inject(RekeyUseCase),
	};
}

describe('RekeyUseCase', () => {
	let repository: LocalDataRepository;
	let rekey: RekeyUseCase;

	beforeEach(() => {
		({ repository, rekey } = configure());
	});

	afterEach(() => {
		IDBObjectStore.prototype.put = REAL_PUT;
	});

	describe('when the server named the whole tree', () => {
		beforeEach(async () => {
			await seedTree(repository);
		});

		it('moves every row to the uuid the server gave it', async () => {
			await rekey.execute(TRAINING, wholeTree());

			await expect(keys(repository)).resolves.toEqual([
				SERVER.training,
				SERVER.goal,
				SERVER.round,
				SERVER.dealt,
				SERVER.set,
				SERVER.cycle,
				SERVER.item,
				SERVER.calibrationAttempt,
				SERVER.cycleAttempt,
			]);
		});

		it('points every child at the new key of its parent', async () => {
			await rekey.execute(TRAINING, wholeTree());

			await expect(repository.find('trainingGoal', SERVER.goal)).resolves.toMatchObject({
				trainingUuid: SERVER.training,
			});
			await expect(repository.find('calibrationPuzzle', SERVER.dealt)).resolves.toMatchObject({
				roundUuid: SERVER.round,
			});
			await expect(repository.find('cycleItem', SERVER.item)).resolves.toMatchObject({
				cycleUuid: SERVER.cycle,
				trainingPuzzleUuid: SERVER.set,
			});
			await expect(repository.find('attempt', SERVER.calibrationAttempt)).resolves.toMatchObject({
				trainingUuid: SERVER.training,
				roundUuid: SERVER.round,
			});
			await expect(repository.find('attempt', SERVER.cycleAttempt)).resolves.toMatchObject({
				trainingUuid: SERVER.training,
				cycleItemUuid: SERVER.item,
			});
		});

		it('leaves no reference to an old key in any of the eight tables nor in the draft', async () => {
			await repository.insert('attemptDraft', draft('item-1', { cycleItemUuid: 'item-1' }));
			await repository.insert(
				'attemptDraft',
				draft(`${TRAINING}/round-1/${PUZZLE}`, { kind: 'calibration', roundUuid: 'round-1' }),
			);

			await rekey.execute(TRAINING, wholeTree());

			const left = (await references(repository)).filter((reference) => LOCAL_KEYS.has(reference));

			expect(left).toEqual([]);
		});

		it('keeps the uuid the row was born with as its `clientRef`', async () => {
			await rekey.execute(TRAINING, wholeTree());

			await expect(repository.find('training', SERVER.training)).resolves.toMatchObject({
				clientRef: TRAINING,
				pendingSince: UPDATED,
			});
			await expect(repository.find('cycleItem', SERVER.item)).resolves.toMatchObject({
				clientRef: 'item-1',
			});
		});

		it('does not touch a tree the push did not name', async () => {
			await repository.insert('training', born(training('training-2')));
			await repository.insert('trainingGoal', born(goal('goal-2', 'training-2')));

			await rekey.execute(TRAINING, wholeTree());

			await expect(repository.find('trainingGoal', 'goal-2')).resolves.toMatchObject({
				trainingUuid: 'training-2',
			});
		});
	});

	describe('when only a branch moved', () => {
		it('follows the round from the puzzles it dealt', async () => {
			await repository.insert('calibrationRound', born(round('round-1')));
			await repository.insert('calibrationPuzzle', born(dealt('dealt-1', 'round-1')));

			await rekey.execute(TRAINING, assigned({ calibrationRound: { 'round-1': SERVER.round } }));

			await expect(repository.find('calibrationPuzzle', 'dealt-1')).resolves.toMatchObject({
				roundUuid: SERVER.round,
			});
		});

		it('follows the exercise of the set from the slot that points at it', async () => {
			await repository.insert('trainingPuzzle', born(exercise('set-1')));
			await repository.insert('cycle', born(pass('cycle-1')));
			await repository.insert('cycleItem', born(slot('item-1', 'cycle-1', 'set-1')));

			await rekey.execute(TRAINING, assigned({ trainingPuzzle: { 'set-1': SERVER.set } }));

			await expect(repository.find('cycleItem', 'item-1')).resolves.toMatchObject({
				cycleUuid: 'cycle-1',
				trainingPuzzleUuid: SERVER.set,
			});
		});

		it('writes nothing when the server gave back the same uuids', async () => {
			await seedTree(repository);

			await rekey.execute(TRAINING, assigned({ training: { [TRAINING]: TRAINING } }));

			await expect(keys(repository)).resolves.toEqual([
				TRAINING,
				'goal-1',
				'round-1',
				'dealt-1',
				'set-1',
				'cycle-1',
				'item-1',
				'attempt-1',
				'attempt-2',
			]);
		});

		it('skips a row another tab already took away', async () => {
			await repository.insert('training', born(training(TRAINING)));
			await repository.insert('trainingGoal', born(goal('goal-1')));

			await rekey.execute(
				TRAINING,
				assigned({
					training: { [TRAINING]: SERVER.training },
					trainingGoal: { 'goal-1': SERVER.goal, gone: 'server-gone' },
				}),
			);

			await expect(repository.find('trainingGoal', 'server-gone')).resolves.toBeUndefined();
			await expect(repository.find('trainingGoal', SERVER.goal)).resolves.toMatchObject({
				trainingUuid: SERVER.training,
			});
		});
	});

	describe('the draft, which never goes up but sits in a slot', () => {
		it('moves to the slot its cycle item now occupies', async () => {
			await repository.insert('cycle', born(pass('cycle-1')));
			await repository.insert('cycleItem', born(slot('item-1', 'cycle-1', 'set-1')));
			await repository.insert('attemptDraft', draft('item-1', { cycleItemUuid: 'item-1' }));

			await rekey.execute(TRAINING, assigned({ cycleItem: { 'item-1': SERVER.item } }));

			await expect(repository.find('attemptDraft', 'item-1')).resolves.toBeUndefined();
			await expect(repository.find('attemptDraft', SERVER.item)).resolves.toMatchObject({
				slotId: SERVER.item,
				cycleItemUuid: SERVER.item,
				trainingUuid: TRAINING,
			});
		});

		it('moves with the round and the training it hangs from', async () => {
			await repository.insert('calibrationRound', born(round('round-1')));
			await repository.insert(
				'attemptDraft',
				draft(`${TRAINING}/round-1/${PUZZLE}`, { kind: 'calibration', roundUuid: 'round-1' }),
			);

			await rekey.execute(
				TRAINING,
				assigned({
					training: { [TRAINING]: SERVER.training },
					calibrationRound: { 'round-1': SERVER.round },
				}),
			);

			await expect(
				repository.find('attemptDraft', `${TRAINING}/round-1/${PUZZLE}`),
			).resolves.toBeUndefined();
			await expect(
				repository.find('attemptDraft', `${SERVER.training}/${SERVER.round}/${PUZZLE}`),
			).resolves.toMatchObject({ trainingUuid: SERVER.training, roundUuid: SERVER.round });
		});

		it('stays where it is when the pass moved but its slot did not', async () => {
			await repository.insert('cycle', born(pass('cycle-1')));
			await repository.insert('cycleItem', born(slot('item-1', 'cycle-1', 'set-1')));
			await repository.insert('attemptDraft', draft('item-1', { cycleItemUuid: 'item-1' }));

			await rekey.execute(TRAINING, assigned({ cycle: { 'cycle-1': SERVER.cycle } }));

			await expect(repository.find('cycleItem', 'item-1')).resolves.toMatchObject({
				cycleUuid: SERVER.cycle,
			});
			await expect(repository.find('attemptDraft', 'item-1')).resolves.toMatchObject({
				slotId: 'item-1',
				cycleItemUuid: 'item-1',
			});
		});

		it('leaves the draft of another training alone', async () => {
			await repository.insert('training', born(training(TRAINING)));
			await repository.insert(
				'attemptDraft',
				draft(`training-2//${PUZZLE}`, { trainingUuid: 'training-2' }),
			);

			await rekey.execute(TRAINING, assigned({ training: { [TRAINING]: SERVER.training } }));

			await expect(repository.find('attemptDraft', `training-2//${PUZZLE}`)).resolves.toMatchObject(
				{ trainingUuid: 'training-2' },
			);
		});
	});

	describe('when a write fails halfway', () => {
		it('leaves the whole tree with the uuids it had', async () => {
			await seedTree(repository);
			failWriting(SERVER.training);

			await expect(rekey.execute(TRAINING, wholeTree())).rejects.toThrow();

			await expect(keys(repository)).resolves.toEqual([
				TRAINING,
				'goal-1',
				'round-1',
				'dealt-1',
				'set-1',
				'cycle-1',
				'item-1',
				'attempt-1',
				'attempt-2',
			]);
			await expect(repository.find('trainingGoal', 'goal-1')).resolves.toMatchObject({
				trainingUuid: TRAINING,
			});
			await expect(repository.find('cycleItem', 'item-1')).resolves.toMatchObject({
				cycleUuid: 'cycle-1',
				trainingPuzzleUuid: 'set-1',
			});
		});
	});
});

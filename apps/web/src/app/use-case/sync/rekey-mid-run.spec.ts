import { TestBed } from '@angular/core/testing';
import type { PushTrainingResult } from '@chesspecker/api-definitions';
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

import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
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
import {
	AttemptDraft,
	AttemptDraftUseCase,
	AttemptIdentity,
	AttemptOutcome,
	AttemptProgress,
} from '@app/use-case/attempt-draft.use-case';
import { born } from '@app/use-case/sync/local-record';
import { RekeyUseCase } from '@app/use-case/sync/rekey.use-case';
import { TrainingEngineUseCase } from '@app/use-case/training-engine.use-case';
import { TrainingRunEngineUseCase } from '@app/use-case/training-run-engine.use-case';

const TRAINING = 'training-1';

const ROUND = 'round-1';

const CYCLE = 'cycle-1';

const CREATED = new Date('2026-08-01T09:00:00.000Z');

const UPDATED = new Date('2026-08-18T09:00:00.000Z');

const SEALED = new Date('2026-08-18T09:05:00.000Z');

const POSITIONS = [0, 1, 2];

function server(uuid: string): string {
	return `server-${uuid}`;
}

function ordinal(position: number): string {
	return (position + 1).toString();
}

function lichessId(position: number): string {
	return `L${ordinal(position)}`;
}

function puzzle(id: string, rating: number): PuzzleRow {
	return {
		uuid: `puzzle-${id}`,
		lichessId: id,
		fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
		moves: ['d1d8'],
		rating,
		themes: ['mateIn1'],
		createdAt: CREATED,
		updatedAt: UPDATED,
	};
}

function training(status: TrainingRow['status']): TrainingRow {
	return born<TrainingRow>({ uuid: TRAINING, status, createdAt: CREATED, updatedAt: UPDATED });
}

function goal(): TrainingGoalRow {
	return born<TrainingGoalRow>({
		uuid: 'goal-1',
		trainingUuid: TRAINING,
		puzzlesPerDay: 10,
		createdAt: CREATED,
		updatedAt: UPDATED,
	});
}

function refineRound(): CalibrationRoundRow {
	return born<CalibrationRoundRow>({
		uuid: ROUND,
		trainingUuid: TRAINING,
		index: 5,
		kind: 'refine',
		rating: 1500,
		outcome: 'pending',
		createdAt: CREATED,
		updatedAt: UPDATED,
	});
}

function dealt(position: number): CalibrationPuzzleRow {
	return born<CalibrationPuzzleRow>({
		uuid: `dealt-${ordinal(position)}`,
		roundUuid: ROUND,
		lichessId: lichessId(position),
		position,
		createdAt: CREATED,
		updatedAt: UPDATED,
	});
}

function exercise(position: number): TrainingPuzzleRow {
	return born<TrainingPuzzleRow>({
		uuid: `set-${ordinal(position)}`,
		trainingUuid: TRAINING,
		lichessId: lichessId(position),
		rating: 1500,
		createdAt: CREATED,
		updatedAt: UPDATED,
	});
}

function pass(): TrainingCycleRow {
	return born<TrainingCycleRow>({
		uuid: CYCLE,
		trainingUuid: TRAINING,
		index: 1,
		status: 'running',
		expectedItems: POSITIONS.length,
		createdAt: CREATED,
		updatedAt: UPDATED,
	});
}

function slot(position: number): CycleItemRow {
	return born<CycleItemRow>({
		uuid: `item-${ordinal(position)}`,
		cycleUuid: CYCLE,
		trainingPuzzleUuid: `set-${ordinal(position)}`,
		lichessId: lichessId(position),
		position,
		createdAt: CREATED,
		updatedAt: UPDATED,
	});
}

function refineIdentity(position: number): AttemptIdentity {
	return {
		trainingUuid: TRAINING,
		kind: 'calibration',
		puzzleUuid: `puzzle-${lichessId(position)}`,
		lichessId: lichessId(position),
		roundUuid: ROUND,
	};
}

function cycleIdentity(position: number): AttemptIdentity {
	return {
		trainingUuid: TRAINING,
		kind: 'cycle',
		puzzleUuid: `puzzle-${lichessId(position)}`,
		lichessId: lichessId(position),
		cycleItemUuid: `item-${ordinal(position)}`,
	};
}

function draft(uuid: string, identity: AttemptIdentity): AttemptDraft {
	return { uuid, identity, createdAt: CREATED };
}

function progress(): AttemptProgress {
	return {
		durationMs: 1200,
		updatedAt: SEALED,
		record: ['d1d8'],
		freePlayRuns: [],
		hintUsed: false,
		mistakeCount: 0,
	};
}

function outcome(): AttemptOutcome {
	return { ...progress(), durationMs: 4000, solved: true, closure: 'found' };
}

function upstream(keys: readonly string[]): Record<string, string> {
	return Object.fromEntries(keys.map((key) => [key, server(key)]));
}

function assigned(over: Partial<PushTrainingResult['uuids']>): PushTrainingResult['uuids'] {
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

function refinePush(): PushTrainingResult['uuids'] {
	return assigned({
		training: upstream([TRAINING]),
		calibrationRound: upstream([ROUND]),
		calibrationPuzzle: upstream(POSITIONS.map((position) => `dealt-${ordinal(position)}`)),
		attempt: upstream(['attempt-1']),
	});
}

function cyclePush(): PushTrainingResult['uuids'] {
	return assigned({
		trainingPuzzle: upstream(POSITIONS.map((position) => `set-${ordinal(position)}`)),
		cycle: upstream([CYCLE]),
		cycleItem: upstream(POSITIONS.map((position) => `item-${ordinal(position)}`)),
		attempt: upstream(['attempt-1']),
	});
}

async function seedRefineRound(repository: LocalDataRepository): Promise<void> {
	await repository.insert('training', training('calibrating'));
	await repository.insert('calibrationRound', refineRound());
	await repository.batchInsert(
		'calibrationPuzzle',
		POSITIONS.map((position) => dealt(position)),
	);
	await repository.batchInsert(
		'puzzle',
		POSITIONS.map((position) => puzzle(lichessId(position), 1500)),
	);
}

async function seedCycle(repository: LocalDataRepository): Promise<void> {
	await repository.insert('training', training('running'));
	await repository.batchInsert(
		'trainingPuzzle',
		POSITIONS.map((position) => exercise(position)),
	);
	await repository.insert('cycle', pass());
	await repository.batchInsert(
		'cycleItem',
		POSITIONS.map((position) => slot(position)),
	);
	await repository.batchInsert(
		'puzzle',
		POSITIONS.map((position) => puzzle(lichessId(position), 1500)),
	);
}

async function seedPlanning(repository: LocalDataRepository): Promise<void> {
	await repository.insert('training', training('planning'));
	await repository.insert('trainingGoal', goal());
	await repository.batchInsert(
		'trainingPuzzle',
		POSITIONS.map((position) => exercise(position)),
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
		rekey: TestBed.inject(RekeyUseCase),
		drafts: TestBed.inject(AttemptDraftUseCase),
		run: TestBed.inject(TrainingRunEngineUseCase),
		engine: TestBed.inject(TrainingEngineUseCase),
	};
}

describe('a run that keeps the uuids it had before a push rekeyed them', () => {
	let repository: LocalDataRepository;
	let rekey: RekeyUseCase;
	let drafts: AttemptDraftUseCase;
	let run: TrainingRunEngineUseCase;
	let engine: TrainingEngineUseCase;

	beforeEach(() => {
		({ repository, rekey, drafts, run, engine } = configure());
	});

	describe('in a refine round whose first exercise already went up', () => {
		beforeEach(async () => {
			await seedRefineRound(repository);
			await drafts.seal(draft('attempt-1', refineIdentity(0)), outcome());
			await rekey.execute(TRAINING, refinePush());
		});

		it('closes a refine round when called with the uuid it had before the push', async () => {
			await expect(run.submitCalibrationAttempt(ROUND)).resolves.toBe('pending');
		});

		it('seals the next refine attempt under the rekeyed round', async () => {
			await drafts.seal(draft('attempt-2', refineIdentity(1)), outcome());

			await expect(repository.find('attempt', 'attempt-2')).resolves.toMatchObject({
				trainingUuid: server(TRAINING),
				roundUuid: server(ROUND),
			});
		});

		it('counts as played the exercise sealed with the old uuids', async () => {
			await drafts.seal(draft('attempt-2', refineIdentity(1)), outcome());

			await expect(run.listRoundPuzzles(server(ROUND))).resolves.toMatchObject({
				total: POSITIONS.length,
				attempted: 2,
			});
		});
	});

	describe('in a new training that went up before its first round', () => {
		beforeEach(async () => {
			await repository.insert('training', training('calibrating'));
			await repository.batchInsert('puzzle', [puzzle('E1', 1200), puzzle('E2', 1250)]);
			await rekey.execute(TRAINING, assigned({ training: upstream([TRAINING]) }));
		});

		it('opens the next round of a new training with its old uuid', async () => {
			const { round } = await run.createRound(TRAINING);

			expect(round.trainingUuid).toBe(server(TRAINING));
		});
	});

	describe('in a cycle whose first exercise already went up', () => {
		beforeEach(async () => {
			await seedCycle(repository);
			await drafts.seal(draft('attempt-1', cycleIdentity(0)), outcome());
			await drafts.save(draft('attempt-2', cycleIdentity(1)), progress());
			await rekey.execute(TRAINING, cyclePush());
		});

		it('seals the next cycle attempt under the rekeyed slot', async () => {
			await drafts.seal(draft('attempt-2', cycleIdentity(1)), outcome());

			await expect(repository.find('attempt', 'attempt-2')).resolves.toMatchObject({
				cycleItemUuid: server('item-2'),
			});
		});

		it('closes the draft the push moved when the exercise is sealed', async () => {
			await drafts.seal(draft('attempt-2', cycleIdentity(1)), outcome());

			await expect(repository.findAll('attemptDraft')).resolves.toEqual([]);
		});

		it('keeps one draft when it is flushed with the old identity', async () => {
			await drafts.save(draft('attempt-2', cycleIdentity(1)), progress());

			await expect(repository.findAll('attemptDraft')).resolves.toMatchObject([
				{ slotId: server('item-2') },
			]);
		});

		it('does not serve again the slot that was just solved', async () => {
			await drafts.seal(draft('attempt-2', cycleIdentity(1)), outcome());

			const next = await run.nextCycleSlot(TRAINING);

			expect(next?.item.lichessId).toBe(lichessId(2));
		});

		it('closes the pass when its last slot is sealed with the uuids the run kept', async () => {
			await drafts.seal(draft('attempt-2', cycleIdentity(1)), outcome());
			await drafts.seal(draft('attempt-3', cycleIdentity(2)), outcome());

			await expect(run.submitCycleAttempt(TRAINING, slot(2))).resolves.toBe(true);
		});
	});

	describe('on the training page after a pass went up in the background', () => {
		beforeEach(async () => {
			await seedPlanning(repository);
			await rekey.execute(
				TRAINING,
				assigned({
					training: upstream([TRAINING]),
					trainingGoal: upstream(['goal-1']),
					trainingPuzzle: upstream(POSITIONS.map((position) => `set-${ordinal(position)}`)),
				}),
			);
		});

		it("saves the goal of the active training with the row's old uuid", async () => {
			await engine.setGoal(TRAINING, { puzzlesPerDay: 20 });

			const goals = await repository.findAllByIndex(
				'trainingGoal',
				'trainingUuid',
				server(TRAINING),
			);

			expect(goals.map((row) => row.puzzlesPerDay)).toContain(20);
		});

		it("starts a cycle on the active training with the row's old uuid", async () => {
			await engine.startCycle(TRAINING);

			await expect(
				repository.findAllByIndex('cycle', 'trainingUuid', server(TRAINING)),
			).resolves.toHaveLength(1);
		});
	});

	describe('when a seal races the push that rekeys its slot', () => {
		beforeEach(async () => {
			await seedCycle(repository);
			await drafts.seal(draft('attempt-1', cycleIdentity(0)), outcome());
		});

		it('leaves no orphan when the rekey commits before the seal', async () => {
			await Promise.all([
				rekey.execute(TRAINING, cyclePush()),
				drafts.seal(draft('attempt-2', cycleIdentity(1)), outcome()),
			]);

			await expect(repository.find('attempt', 'attempt-2')).resolves.toMatchObject({
				cycleItemUuid: server('item-2'),
			});
		});

		it('leaves no orphan when the seal commits before the rekey', async () => {
			await Promise.all([
				drafts.seal(draft('attempt-2', cycleIdentity(1)), outcome()),
				rekey.execute(TRAINING, cyclePush()),
			]);

			await expect(repository.find('attempt', 'attempt-2')).resolves.toMatchObject({
				cycleItemUuid: server('item-2'),
			});
		});
	});
});

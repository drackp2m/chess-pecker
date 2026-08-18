import type { PushTrainingResult } from '@chesspecker/api-definitions';
import { EntityManager } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';

import { createIntegrationTestingModule } from '../../../shared/test/create-integration-testing-module';
import { GenerateUuidUseCase } from '../../../shared/use-case/generate-uuid.use-case';
import { AppModule } from '../../app/app.module';
import { Puzzle } from '../../puzzle/puzzle.entity';
import { CalibrationRoundKind } from '../../training/definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from '../../training/definition/calibration-round-outcome.enum';
import { PuzzleAttemptClosure } from '../../training/definition/puzzle-attempt-closure.enum';
import { TrainingCycleStatus } from '../../training/definition/training-cycle-status.enum';
import { TrainingStatus } from '../../training/definition/training-status.enum';
import { PuzzleAttempt } from '../../training/puzzle-attempt.entity';
import { TrainingCalibrationPuzzle } from '../../training/training-calibration-puzzle.entity';
import { TrainingCalibrationRound } from '../../training/training-calibration-round.entity';
import { TrainingCycleItem } from '../../training/training-cycle-item.entity';
import { TrainingCycle } from '../../training/training-cycle.entity';
import { TrainingGoal } from '../../training/training-goal.entity';
import { TrainingPuzzle } from '../../training/training-puzzle.entity';
import { Training } from '../../training/training.entity';
import { User } from '../../user/user.entity';
import { PushAttemptNodeDto } from '../dto/request/push-attempt-node.dto';
import { PushTrainingRequestDto } from '../dto/request/push-training-request.dto';
import { SyncModule } from '../sync.module';

import { PushTrainingTreeUseCase } from './push-training-tree.use-case';

const CALIBRATION_PUZZLE = 'aaaaa';

const SET_PUZZLE = 'bbbbb';

const BORN = new Date('2026-08-01T09:00:00.000Z');

const CLOSED = new Date('2026-08-02T18:30:00.000Z');

interface TreeRefs {
	training: string;
	goal: string;
	round: string;
	dealt: string;
	set: string;
	cycle: string;
	item: string;
	calibrationAttempt: string;
	cycleAttempt: string;
}

interface TreeCounts {
	training: number;
	goal: number;
	round: number;
	dealt: number;
	set: number;
	cycle: number;
	item: number;
	attempt: number;
}

function buildRefs(): TreeRefs {
	const uuid = (): string => new GenerateUuidUseCase().execute();

	return {
		training: uuid(),
		goal: uuid(),
		round: uuid(),
		dealt: uuid(),
		set: uuid(),
		cycle: uuid(),
		item: uuid(),
		calibrationAttempt: uuid(),
		cycleAttempt: uuid(),
	};
}

function attempt(clientRef: string, lichessId: string): PushAttemptNodeDto {
	return {
		clientRef,
		createdAt: BORN,
		updatedAt: CLOSED,
		lichessId,
		durationMs: 12_000,
		solved: true,
		closure: PuzzleAttemptClosure.Found,
		hintUsed: false,
		mistakeCount: 0,
		record: [],
		explorations: [],
	};
}

/**
 * Un árbol con una fila de cada tabla, que es lo que hace falta para que un recuento
 * signifique algo: si la subida duplicase, duplicaría en alguna de las ocho.
 */
function buildTree(refs: TreeRefs): PushTrainingRequestDto {
	return {
		training: {
			clientRef: refs.training,
			createdAt: BORN,
			updatedAt: CLOSED,
			status: TrainingStatus.Running,
			goals: [{ clientRef: refs.goal, createdAt: BORN, updatedAt: BORN, puzzlesPerDay: 10 }],
			rounds: [
				{
					clientRef: refs.round,
					createdAt: BORN,
					updatedAt: CLOSED,
					index: 1,
					kind: CalibrationRoundKind.Scan,
					rating: 1500,
					outcome: CalibrationRoundOutcome.Accept,
					puzzles: [
						{
							clientRef: refs.dealt,
							createdAt: BORN,
							updatedAt: BORN,
							lichessId: CALIBRATION_PUZZLE,
							position: 0,
						},
					],
					attempts: [attempt(refs.calibrationAttempt, CALIBRATION_PUZZLE)],
				},
			],
			puzzles: [{ clientRef: refs.set, createdAt: BORN, updatedAt: BORN, lichessId: SET_PUZZLE }],
			cycles: [
				{
					clientRef: refs.cycle,
					createdAt: BORN,
					updatedAt: BORN,
					index: 1,
					status: TrainingCycleStatus.Running,
					items: [
						{
							clientRef: refs.item,
							createdAt: BORN,
							updatedAt: BORN,
							trainingPuzzleRef: refs.set,
							position: 0,
							attempts: [attempt(refs.cycleAttempt, SET_PUZZLE)],
						},
					],
				},
			],
		},
	};
}

describe('PushTrainingTreeUseCase', () => {
	let module: TestingModule;
	let entityManager: EntityManager;
	let useCase: PushTrainingTreeUseCase;
	let user: User;

	const push = async (refs: TreeRefs): Promise<PushTrainingResult> =>
		useCase.execute(user, buildTree(refs));

	const countTree = async (): Promise<TreeCounts> => {
		const em = entityManager.fork();

		return {
			training: await em.count(Training, {}),
			goal: await em.count(TrainingGoal, {}),
			round: await em.count(TrainingCalibrationRound, {}),
			dealt: await em.count(TrainingCalibrationPuzzle, {}),
			set: await em.count(TrainingPuzzle, {}),
			cycle: await em.count(TrainingCycle, {}),
			item: await em.count(TrainingCycleItem, {}),
			attempt: await em.count(PuzzleAttempt, {}),
		};
	};

	beforeAll(async () => {
		module = await createIntegrationTestingModule({ imports: [AppModule, SyncModule] });

		entityManager = module.get(EntityManager);
		useCase = module.get(PushTrainingTreeUseCase);
	});

	afterAll(async () => {
		await module.close();
	});

	beforeEach(async () => {
		const em = entityManager.fork();

		await em.nativeDelete(User, {});
		await em.nativeDelete(Puzzle, {});

		user = new User({ username: 'drackp2m', password: 'password' });

		em.persist(user);

		for (const lichessId of [CALIBRATION_PUZZLE, SET_PUZZLE]) {
			em.persist(
				new Puzzle({
					lichessId,
					fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
					moves: ['e2e4', 'e7e5'],
					rating: 1500,
					themes: ['fork'],
				}),
			);
		}

		await em.flush();
	});

	describe('when the same tree goes up twice', () => {
		it('gives back the uuids of the rows already there, without a second copy', async () => {
			const refs = buildRefs();

			const first = await push(refs);
			const second = await push(refs);
			const training = await entityManager
				.fork()
				.findOneOrFail(Training, { clientRef: refs.training });

			expect(second.uuids).toStrictEqual(first.uuids);
			expect(second.rejected).toStrictEqual([]);
			expect(second.uuids.training[refs.training]).toStrictEqual(training.uuid);
			await expect(countTree()).resolves.toStrictEqual({
				training: 1,
				goal: 1,
				round: 1,
				dealt: 1,
				set: 1,
				cycle: 1,
				item: 1,
				attempt: 2,
			});
		});
	});

	describe('the dates the device sent', () => {
		it('are stored as they came, and only `receivedAt` is the clock of the server', async () => {
			const refs = buildRefs();

			const result = await push(refs);
			const training = await entityManager
				.fork()
				.findOneOrFail(Training, { clientRef: refs.training });
			const closed = await entityManager
				.fork()
				.findOneOrFail(PuzzleAttempt, { clientRef: refs.cycleAttempt });

			expect(training.createdAt).toStrictEqual(BORN);
			expect(training.updatedAt).toStrictEqual(CLOSED);
			expect(closed.createdAt).toStrictEqual(BORN);
			expect(closed.updatedAt).toStrictEqual(CLOSED);
			expect(training.receivedAt.toISOString()).toStrictEqual(result.receivedAt);
			expect(closed.receivedAt.toISOString()).toStrictEqual(result.receivedAt);
		});
	});
});

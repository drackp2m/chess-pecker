import type { PushTrainingResult } from '@chesspecker/api-definitions';
import { EntityManager } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';

import { createIntegrationTestingModule } from '../../../shared/test/create-integration-testing-module';
import { AppModule } from '../../app/app.module';
import { CalibrationRoundKind } from '../../training/definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from '../../training/definition/calibration-round-outcome.enum';
import { PuzzleAttemptKind } from '../../training/definition/puzzle-attempt-kind.enum';
import { TrainingCycleStatus } from '../../training/definition/training-cycle-status.enum';
import { TrainingFinishedReason } from '../../training/definition/training-finished-reason.enum';
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
import { PushTrainingNodeDto } from '../dto/request/push-training-node.dto';
import { PushTrainingRequestDto } from '../dto/request/push-training-request.dto';
import { SyncModule } from '../sync.module';
import {
	BORN,
	CALIBRATION_PUZZLE,
	CLOSED,
	EXTRA_PUZZLE,
	PlainNode,
	SET_PUZZLE,
	SPARE_PUZZLE,
	TreeRefs,
	UNKNOWN_PUZZLE,
	attemptNode,
	buildRefs,
	buildTree,
	resetTrainingFixtures,
	trainingNode,
	uuid,
} from '../test/training-tree.fixture';

import { PushTrainingTreeUseCase } from './push-training-tree.use-case';

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

function tree(
	refs: TreeRefs,
	node: Partial<PlainNode<PushTrainingNodeDto>>,
): PushTrainingRequestDto {
	return { training: { ...trainingNode(refs), ...node } };
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
		user = await resetTrainingFixtures(entityManager);
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

	describe('a training still calibrating', () => {
		it('goes up on a scan round, with what it dealt and what was played', async () => {
			const refs = buildRefs();

			const result = await useCase.execute(
				user,
				tree(refs, {
					status: TrainingStatus.Calibrating,
					rounds: [
						{
							clientRef: refs.round,
							createdAt: BORN,
							updatedAt: BORN,
							index: 1,
							kind: CalibrationRoundKind.Scan,
							rating: 1200,
							outcome: CalibrationRoundOutcome.Raise,
							puzzles: [
								{
									clientRef: refs.dealt,
									createdAt: BORN,
									updatedAt: BORN,
									lichessId: CALIBRATION_PUZZLE,
									position: 0,
								},
							],
							attempts: [attemptNode(refs.calibrationAttempt, CALIBRATION_PUZZLE)],
						},
					],
					puzzles: [],
					cycles: [],
				}),
			);
			const em = entityManager.fork();
			const training = await em.findOneOrFail(Training, { clientRef: refs.training });
			const round = await em.findOneOrFail(TrainingCalibrationRound, { clientRef: refs.round });
			const played = await em.findOneOrFail(PuzzleAttempt, {
				clientRef: refs.calibrationAttempt,
			});

			expect(result.rejected).toStrictEqual([]);
			expect(training.status).toStrictEqual(TrainingStatus.Calibrating);
			expect(round.kind).toStrictEqual(CalibrationRoundKind.Scan);
			expect(round.outcome).toStrictEqual(CalibrationRoundOutcome.Raise);
			expect(round.rating).toStrictEqual(1200);
			expect(played.kind).toStrictEqual(PuzzleAttemptKind.Calibration);
			expect(played.calibrationRound?.uuid).toStrictEqual(round.uuid);
			await expect(countTree()).resolves.toMatchObject({
				round: 1,
				dealt: 1,
				set: 0,
				cycle: 0,
				item: 0,
				attempt: 1,
			});
		});

		it('goes up in the middle of a refine round, with the scan rounds behind it', async () => {
			const refs = buildRefs();
			const refine = uuid();
			const dealtRefs = [uuid(), uuid(), uuid()];
			const playedRefs = [uuid(), uuid()];
			const lichessIds = [CALIBRATION_PUZZLE, SET_PUZZLE, SPARE_PUZZLE];

			const result = await useCase.execute(
				user,
				tree(refs, {
					status: TrainingStatus.Calibrating,
					rounds: [
						{
							clientRef: refs.round,
							createdAt: BORN,
							updatedAt: BORN,
							index: 1,
							kind: CalibrationRoundKind.Scan,
							rating: 1200,
							outcome: CalibrationRoundOutcome.Accept,
							puzzles: [
								{
									clientRef: refs.dealt,
									createdAt: BORN,
									updatedAt: BORN,
									lichessId: EXTRA_PUZZLE,
									position: 0,
								},
							],
							attempts: [attemptNode(refs.calibrationAttempt, EXTRA_PUZZLE)],
						},
						{
							clientRef: refine,
							createdAt: BORN,
							updatedAt: BORN,
							index: 2,
							kind: CalibrationRoundKind.Refine,
							rating: 1200,
							outcome: CalibrationRoundOutcome.Pending,
							puzzles: dealtRefs.map((clientRef, position) => ({
								clientRef,
								createdAt: BORN,
								updatedAt: BORN,
								lichessId: lichessIds[position] ?? CALIBRATION_PUZZLE,
								position,
							})),
							attempts: playedRefs.map((clientRef, index) =>
								attemptNode(clientRef, lichessIds[index] ?? CALIBRATION_PUZZLE),
							),
						},
					],
					puzzles: [],
					cycles: [],
				}),
			);
			const em = entityManager.fork();
			const round = await em.findOneOrFail(TrainingCalibrationRound, { clientRef: refine });

			expect(result.rejected).toStrictEqual([]);
			expect(round.kind).toStrictEqual(CalibrationRoundKind.Refine);
			expect(round.outcome).toStrictEqual(CalibrationRoundOutcome.Pending);
			await expect(
				em.count(TrainingCalibrationPuzzle, { calibrationRound: round }),
			).resolves.toStrictEqual(3);
			await expect(em.count(PuzzleAttempt, { calibrationRound: round })).resolves.toStrictEqual(2);
			await expect(countTree()).resolves.toMatchObject({ round: 2, dealt: 4, attempt: 3 });
		});
	});

	describe('a training in the middle of a cycle', () => {
		it('goes up with the slots that have no attempt yet, and the cycle stays open', async () => {
			const refs = buildRefs();
			const spare = uuid();
			const empty = uuid();

			const result = await useCase.execute(
				user,
				tree(refs, {
					puzzles: [
						{ clientRef: refs.set, createdAt: BORN, updatedAt: BORN, lichessId: SET_PUZZLE },
						{ clientRef: spare, createdAt: BORN, updatedAt: BORN, lichessId: SPARE_PUZZLE },
					],
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
									attempts: [attemptNode(refs.cycleAttempt, SET_PUZZLE)],
								},
								{
									clientRef: empty,
									createdAt: BORN,
									updatedAt: BORN,
									trainingPuzzleRef: spare,
									position: 1,
									attempts: [],
								},
							],
						},
					],
				}),
			);
			const em = entityManager.fork();
			const cycle = await em.findOneOrFail(TrainingCycle, { clientRef: refs.cycle });
			const pending = await em.findOneOrFail(TrainingCycleItem, { clientRef: empty });

			expect(result.rejected).toStrictEqual([]);
			expect(cycle.status).toStrictEqual(TrainingCycleStatus.Running);
			expect(pending.position).toStrictEqual(1);
			await expect(em.count(PuzzleAttempt, { cycleItem: pending })).resolves.toStrictEqual(0);
			await expect(countTree()).resolves.toMatchObject({ set: 2, cycle: 1, item: 2, attempt: 2 });
		});
	});

	describe('a training that is over', () => {
		it('keeps how it finished, and a cycle with every slot played stays closed', async () => {
			const refs = buildRefs();

			const result = await useCase.execute(
				user,
				tree(refs, {
					status: TrainingStatus.Finished,
					finishedReason: TrainingFinishedReason.Completed,
					finishedAt: CLOSED,
					cycles: [
						{
							clientRef: refs.cycle,
							createdAt: BORN,
							updatedAt: CLOSED,
							index: 1,
							status: TrainingCycleStatus.Finished,
							items: [
								{
									clientRef: refs.item,
									createdAt: BORN,
									updatedAt: BORN,
									trainingPuzzleRef: refs.set,
									position: 0,
									attempts: [attemptNode(refs.cycleAttempt, SET_PUZZLE)],
								},
							],
						},
					],
				}),
			);
			const em = entityManager.fork();
			const training = await em.findOneOrFail(Training, { clientRef: refs.training });
			const cycle = await em.findOneOrFail(TrainingCycle, { clientRef: refs.cycle });

			expect(result.rejected).toStrictEqual([]);
			expect(training.status).toStrictEqual(TrainingStatus.Finished);
			expect(training.finishedReason).toStrictEqual(TrainingFinishedReason.Completed);
			expect(training.finishedAt).toStrictEqual(CLOSED);
			expect(cycle.status).toStrictEqual(TrainingCycleStatus.Finished);
		});

		it('leaves a cycle open when the device closed it with a slot never played', async () => {
			const refs = buildRefs();
			const spare = uuid();
			const empty = uuid();

			const result = await useCase.execute(
				user,
				tree(refs, {
					status: TrainingStatus.Finished,
					finishedReason: TrainingFinishedReason.Completed,
					finishedAt: CLOSED,
					puzzles: [
						{ clientRef: refs.set, createdAt: BORN, updatedAt: BORN, lichessId: SET_PUZZLE },
						{ clientRef: spare, createdAt: BORN, updatedAt: BORN, lichessId: SPARE_PUZZLE },
					],
					cycles: [
						{
							clientRef: refs.cycle,
							createdAt: BORN,
							updatedAt: CLOSED,
							index: 1,
							status: TrainingCycleStatus.Finished,
							items: [
								{
									clientRef: refs.item,
									createdAt: BORN,
									updatedAt: BORN,
									trainingPuzzleRef: refs.set,
									position: 0,
									attempts: [attemptNode(refs.cycleAttempt, SET_PUZZLE)],
								},
								{
									clientRef: empty,
									createdAt: BORN,
									updatedAt: BORN,
									trainingPuzzleRef: spare,
									position: 1,
									attempts: [],
								},
							],
						},
					],
				}),
			);
			const em = entityManager.fork();
			const cycle = await em.findOneOrFail(TrainingCycle, { clientRef: refs.cycle });
			const training = await em.findOneOrFail(Training, { clientRef: refs.training });

			expect(result.rejected).toStrictEqual([]);
			expect(cycle.status).toStrictEqual(TrainingCycleStatus.Running);
			expect(training.status).toStrictEqual(TrainingStatus.Finished);
		});
	});

	describe('a training the user cancelled', () => {
		it('goes up abandoned, with the reason and the moment it stopped', async () => {
			const refs = buildRefs();

			const result = await useCase.execute(
				user,
				tree(refs, {
					status: TrainingStatus.Abandoned,
					finishedReason: TrainingFinishedReason.Cancelled,
					finishedAt: CLOSED,
					cycles: [
						{
							clientRef: refs.cycle,
							createdAt: BORN,
							updatedAt: CLOSED,
							index: 1,
							status: TrainingCycleStatus.Abandoned,
							items: [
								{
									clientRef: refs.item,
									createdAt: BORN,
									updatedAt: BORN,
									trainingPuzzleRef: refs.set,
									position: 0,
									attempts: [attemptNode(refs.cycleAttempt, SET_PUZZLE)],
								},
							],
						},
					],
				}),
			);
			const em = entityManager.fork();
			const training = await em.findOneOrFail(Training, { clientRef: refs.training });
			const cycle = await em.findOneOrFail(TrainingCycle, { clientRef: refs.cycle });

			expect(result.rejected).toStrictEqual([]);
			expect(training.status).toStrictEqual(TrainingStatus.Abandoned);
			expect(training.finishedReason).toStrictEqual(TrainingFinishedReason.Cancelled);
			expect(training.finishedAt).toStrictEqual(CLOSED);
			expect(cycle.status).toStrictEqual(TrainingCycleStatus.Abandoned);
		});
	});

	describe('when a `lichessId` is not in the catalog', () => {
		it('rejects that set entry, the slot behind it and nothing else', async () => {
			const refs = buildRefs();
			const stray = uuid();
			const strayItem = uuid();
			const strayAttempt = uuid();

			const result = await useCase.execute(
				user,
				tree(refs, {
					puzzles: [
						{ clientRef: refs.set, createdAt: BORN, updatedAt: BORN, lichessId: SET_PUZZLE },
						{ clientRef: stray, createdAt: BORN, updatedAt: BORN, lichessId: UNKNOWN_PUZZLE },
					],
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
									attempts: [attemptNode(refs.cycleAttempt, SET_PUZZLE)],
								},
								{
									clientRef: strayItem,
									createdAt: BORN,
									updatedAt: BORN,
									trainingPuzzleRef: stray,
									position: 1,
									attempts: [attemptNode(strayAttempt, UNKNOWN_PUZZLE)],
								},
							],
						},
					],
				}),
			);

			expect(result.rejected).toStrictEqual([
				{
					clientRef: stray,
					entity: 'trainingPuzzle',
					reason: `unknown puzzle \`${UNKNOWN_PUZZLE}\``,
				},
				{
					clientRef: strayItem,
					entity: 'cycleItem',
					reason: `unknown set entry \`${stray}\``,
				},
			]);
			expect(result.uuids.trainingPuzzle[stray]).toBeUndefined();
			expect(result.uuids.cycleItem[strayItem]).toBeUndefined();
			expect(result.uuids.attempt[strayAttempt]).toBeUndefined();
			expect(result.uuids.trainingPuzzle[refs.set]).toBeDefined();
			expect(result.uuids.cycleItem[refs.item]).toBeDefined();
			expect(result.uuids.attempt[refs.cycleAttempt]).toBeDefined();
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

		it('rejects what the round dealt and what was played on it, but not the round', async () => {
			const refs = buildRefs();
			const stray = uuid();
			const strayAttempt = uuid();

			const result = await useCase.execute(
				user,
				tree(refs, {
					rounds: [
						{
							clientRef: refs.round,
							createdAt: BORN,
							updatedAt: CLOSED,
							index: 1,
							kind: CalibrationRoundKind.Refine,
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
								{
									clientRef: stray,
									createdAt: BORN,
									updatedAt: BORN,
									lichessId: UNKNOWN_PUZZLE,
									position: 1,
								},
							],
							attempts: [
								attemptNode(refs.calibrationAttempt, CALIBRATION_PUZZLE),
								attemptNode(strayAttempt, UNKNOWN_PUZZLE),
							],
						},
					],
				}),
			);
			const em = entityManager.fork();
			const round = await em.findOneOrFail(TrainingCalibrationRound, { clientRef: refs.round });

			expect(result.rejected).toStrictEqual([
				{
					clientRef: stray,
					entity: 'calibrationPuzzle',
					reason: `unknown puzzle \`${UNKNOWN_PUZZLE}\``,
				},
				{
					clientRef: strayAttempt,
					entity: 'attempt',
					reason: `unknown puzzle \`${UNKNOWN_PUZZLE}\``,
				},
			]);
			expect(result.uuids.calibrationRound[refs.round]).toStrictEqual(round.uuid);
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
});

import { EntityManager } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';

import { createIntegrationTestingModule } from '../../../shared/test/create-integration-testing-module';
import { SYNC_SCHEMA_VERSION } from '../../../shared/util/sync-schema-version';
import { AppModule } from '../../app/app.module';
import { TrainingCycleStatus } from '../../training/definition/training-cycle-status.enum';
import { TrainingCycle } from '../../training/training-cycle.entity';
import { User } from '../../user/user.entity';
import { PushTrainingRequestDto } from '../dto/request/push-training-request.dto';
import { SyncModule } from '../sync.module';
import {
	BORN,
	CATALOG,
	SET_PUZZLE,
	SPARE_PUZZLE,
	TreeRefs,
	buildRefs,
	buildTree,
	resetTrainingFixtures,
	seedUser,
	trainingNode,
	uuid,
} from '../test/training-tree.fixture';

import { GetSyncSummaryUseCase } from './get-sync-summary.use-case';
import { PushTrainingTreeUseCase } from './push-training-tree.use-case';

const NOTHING = { cursor: null, count: 0 };

describe('GetSyncSummaryUseCase', () => {
	let module: TestingModule;
	let entityManager: EntityManager;
	let useCase: GetSyncSummaryUseCase;
	let pushTrainingTreeUseCase: PushTrainingTreeUseCase;
	let user: User;

	beforeAll(async () => {
		module = await createIntegrationTestingModule({ imports: [AppModule, SyncModule] });

		entityManager = module.get(EntityManager);
		useCase = module.get(GetSyncSummaryUseCase);
		pushTrainingTreeUseCase = module.get(PushTrainingTreeUseCase);
	});

	afterAll(async () => {
		await module.close();
	});

	beforeEach(async () => {
		user = await resetTrainingFixtures(entityManager);
	});

	describe('after a push', () => {
		it('answers with the mark that push got and one count per table', async () => {
			const result = await pushTrainingTreeUseCase.execute(user, buildTree(buildRefs()));

			const summary = await useCase.execute(user);

			expect(summary.entities).toStrictEqual({
				training: { cursor: result.receivedAt, count: 1 },
				trainingGoal: { cursor: result.receivedAt, count: 1 },
				calibrationRound: { cursor: result.receivedAt, count: 1 },
				calibrationPuzzle: { cursor: result.receivedAt, count: 1 },
				trainingPuzzle: { cursor: result.receivedAt, count: 1 },
				cycle: { cursor: result.receivedAt, count: 1 },
				cycleItem: { cursor: result.receivedAt, count: 1 },
				attempt: { cursor: result.receivedAt, count: 2 },
			});
			expect(summary.schemaVersion).toStrictEqual(SYNC_SCHEMA_VERSION);
			expect(summary.catalog.total).toStrictEqual(CATALOG.length);
		});

		it('does not move when the same tree goes up again, because nothing was inserted', async () => {
			const refs = buildRefs();

			const first = await pushTrainingTreeUseCase.execute(user, buildTree(refs));
			await pushTrainingTreeUseCase.execute(user, buildTree(refs));

			const summary = await useCase.execute(user);

			expect(summary.entities.training).toStrictEqual({ cursor: first.receivedAt, count: 1 });
			expect(summary.entities.attempt).toStrictEqual({ cursor: first.receivedAt, count: 2 });
		});
	});

	describe('what belongs to somebody else', () => {
		it('neither counts nor moves the mark', async () => {
			const mine = await pushTrainingTreeUseCase.execute(user, buildTree(buildRefs()));
			const other = await seedUser(entityManager, 'other');

			await pushTrainingTreeUseCase.execute(other, buildTree(buildRefs()));

			const summary = await useCase.execute(user);

			expect(summary.entities.training).toStrictEqual({ cursor: mine.receivedAt, count: 1 });
			expect(summary.entities.cycleItem).toStrictEqual({ cursor: mine.receivedAt, count: 1 });
			expect(summary.entities.attempt).toStrictEqual({ cursor: mine.receivedAt, count: 2 });
		});
	});

	describe('a user who has never pushed', () => {
		it('gets every table empty and no cursor to compare against', async () => {
			const summary = await useCase.execute(user);

			expect(summary.entities).toStrictEqual({
				training: NOTHING,
				trainingGoal: NOTHING,
				calibrationRound: NOTHING,
				calibrationPuzzle: NOTHING,
				trainingPuzzle: NOTHING,
				cycle: NOTHING,
				cycleItem: NOTHING,
				attempt: NOTHING,
			});
			expect(summary.catalog.total).toStrictEqual(CATALOG.length);
		});
	});

	describe('a cycle whose slots did not all make it up', () => {
		const cutTree = (refs: TreeRefs, itemCount: number): PushTrainingRequestDto => ({
			training: {
				...trainingNode(refs),
				cycles: [
					{
						clientRef: refs.cycle,
						createdAt: BORN,
						updatedAt: BORN,
						index: 1,
						status: TrainingCycleStatus.Running,
						itemCount,
						items: [
							{
								clientRef: refs.item,
								createdAt: BORN,
								updatedAt: BORN,
								trainingPuzzleRef: refs.set,
								position: 0,
								attempts: [],
							},
						],
					},
				],
			},
		});

		it('is listed with what it declared against what is stored', async () => {
			const refs = buildRefs();

			await pushTrainingTreeUseCase.execute(user, cutTree(refs, 3));

			const summary = await useCase.execute(user);
			const em = entityManager.fork();
			const cycle = await em.findOneOrFail(TrainingCycle, { clientRef: refs.cycle });

			expect(summary.partialCycles).toStrictEqual([
				{
					uuid: cycle.uuid,
					trainingUuid: cycle.training.uuid,
					index: 1,
					itemCount: 3,
					storedItems: 1,
				},
			]);
		});

		it('drops off the list once every slot it declared is up', async () => {
			const refs = buildRefs();

			await pushTrainingTreeUseCase.execute(user, cutTree(refs, 1));

			const summary = await useCase.execute(user);

			expect(summary.partialCycles).toStrictEqual([]);
		});

		it('is listed when the set says more than the cycle declares', async () => {
			const refs = buildRefs();
			const spare = uuid();
			const cut = cutTree(refs, 1);

			cut.training.puzzles = [
				{ clientRef: refs.set, createdAt: BORN, updatedAt: BORN, lichessId: SET_PUZZLE },
				{ clientRef: spare, createdAt: BORN, updatedAt: BORN, lichessId: SPARE_PUZZLE },
			];

			await pushTrainingTreeUseCase.execute(user, cut);

			const summary = await useCase.execute(user);

			expect(summary.partialCycles).toMatchObject([{ index: 1, itemCount: 2, storedItems: 1 }]);
		});

		it("is nobody else's business", async () => {
			const other = await seedUser(entityManager, 'other');

			await pushTrainingTreeUseCase.execute(other, cutTree(buildRefs(), 3));

			const summary = await useCase.execute(user);

			expect(summary.partialCycles).toStrictEqual([]);
		});
	});
});

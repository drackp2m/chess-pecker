import { EntityManager } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';

import { createIntegrationTestingModule } from '../../../shared/test/create-integration-testing-module';
import { SYNC_SCHEMA_VERSION } from '../../../shared/util/sync-schema-version';
import { AppModule } from '../../app/app.module';
import { User } from '../../user/user.entity';
import { SyncModule } from '../sync.module';
import {
	CATALOG,
	buildRefs,
	buildTree,
	resetTrainingFixtures,
	seedUser,
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
});

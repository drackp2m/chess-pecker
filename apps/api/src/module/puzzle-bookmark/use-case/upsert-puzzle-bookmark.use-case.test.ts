import { EntityManager } from '@mikro-orm/core';
import { TestingModule } from '@nestjs/testing';

import { NotFoundException } from '../../../shared/exception/not-found.exception';
import { createIntegrationTestingModule } from '../../../shared/test/create-integration-testing-module';
import { AppModule } from '../../app/app.module';
import {
	SET_PUZZLE,
	SPARE_PUZZLE,
	UNKNOWN_PUZZLE,
	resetTrainingFixtures,
	seedUser,
	uuid,
} from '../../sync/test/training-tree.fixture';
import { User } from '../../user/user.entity';
import { PuzzleBookmarkHistory } from '../puzzle-bookmark-history.entity';
import { PuzzleBookmark } from '../puzzle-bookmark.entity';
import { PuzzleBookmarkModule } from '../puzzle-bookmark.module';

import { ListPuzzleBookmarkHistoryUseCase } from './list-puzzle-bookmark-history.use-case';
import { ListPuzzleBookmarksUseCase } from './list-puzzle-bookmarks.use-case';
import { UpsertPuzzleBookmarkUseCase } from './upsert-puzzle-bookmark.use-case';

const OLD = new Date('2026-08-01T10:00:00.000Z');
const NEW = new Date('2026-08-02T10:00:00.000Z');
const FUTURE = new Date('2099-01-01T00:00:00.000Z');

describe('UpsertPuzzleBookmarkUseCase', () => {
	let module: TestingModule;
	let entityManager: EntityManager;
	let useCase: UpsertPuzzleBookmarkUseCase;
	let listUseCase: ListPuzzleBookmarksUseCase;
	let historyUseCase: ListPuzzleBookmarkHistoryUseCase;
	let user: User;

	beforeAll(async () => {
		module = await createIntegrationTestingModule({ imports: [AppModule, PuzzleBookmarkModule] });

		entityManager = module.get(EntityManager);
		useCase = module.get(UpsertPuzzleBookmarkUseCase);
		listUseCase = module.get(ListPuzzleBookmarksUseCase);
		historyUseCase = module.get(ListPuzzleBookmarkHistoryUseCase);
	});

	afterAll(async () => {
		await module.close();
	});

	beforeEach(async () => {
		user = await resetTrainingFixtures(entityManager);
	});

	describe('the current list', () => {
		it('files an exercise and answers with it', async () => {
			const attemptUuid = uuid();

			const filed = await useCase.execute(user, SET_PUZZLE, {
				type: 'hard',
				attemptUuid,
				updatedAt: OLD,
			});

			expect(filed).toMatchObject({
				lichessId: SET_PUZZLE,
				type: 'hard',
				attemptUuid,
				updatedAt: OLD.toISOString(),
			});
			expect(await listUseCase.execute(user)).toStrictEqual([filed]);
		});

		it('moves an exercise filed again instead of adding a second row', async () => {
			const first = await useCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: OLD });
			await useCase.execute(user, SET_PUZZLE, { type: 'easy', updatedAt: NEW });

			const bookmarks = await listUseCase.execute(user);

			expect(bookmarks).toHaveLength(1);
			expect(bookmarks[0]).toMatchObject({
				uuid: first.uuid,
				type: 'easy',
				createdAt: first.createdAt,
				updatedAt: NEW.toISOString(),
			});
		});

		it('does not let an older filing overwrite a newer one', async () => {
			await useCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: NEW });
			await useCase.execute(user, SET_PUZZLE, { type: 'easy', updatedAt: OLD });

			const bookmarks = await listUseCase.execute(user);

			expect(bookmarks).toHaveLength(1);
			expect(bookmarks[0]).toMatchObject({ type: 'hard', updatedAt: NEW.toISOString() });
		});

		it('lets a filing at the same instant as the stored one take over', async () => {
			await useCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: NEW });
			await useCase.execute(user, SET_PUZZLE, { type: 'easy', updatedAt: NEW });

			const bookmarks = await listUseCase.execute(user);

			expect(bookmarks).toHaveLength(1);
			expect(bookmarks[0]).toMatchObject({ type: 'easy', updatedAt: NEW.toISOString() });
		});

		it('keeps the attempt of the filing that won', async () => {
			const winner = uuid();

			await useCase.execute(user, SET_PUZZLE, {
				type: 'hard',
				attemptUuid: winner,
				updatedAt: NEW,
			});
			await useCase.execute(user, SET_PUZZLE, {
				type: 'easy',
				attemptUuid: uuid(),
				updatedAt: OLD,
			});

			expect((await listUseCase.execute(user))[0]?.attemptUuid).toStrictEqual(winner);
		});

		it('stamps the filing with the server clock when the device sends none', async () => {
			const before = Date.now();

			const filed = await useCase.execute(user, SET_PUZZLE, { type: 'favorite' });

			expect(new Date(filed.updatedAt).getTime()).toBeGreaterThanOrEqual(before);
			expect(new Date(filed.updatedAt).getTime()).toBeLessThanOrEqual(Date.now());
		});

		it('stamps a filing dated in the future with the server clock instead', async () => {
			const before = Date.now();

			const filed = await useCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: FUTURE });

			expect(new Date(filed.updatedAt).getTime()).toBeGreaterThanOrEqual(before);
			expect(new Date(filed.updatedAt).getTime()).toBeLessThanOrEqual(Date.now());
		});

		it('does not let a device running ahead outrank a later filing', async () => {
			await useCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: FUTURE });
			await useCase.execute(user, SET_PUZZLE, { type: 'easy', updatedAt: new Date() });

			const bookmarks = await listUseCase.execute(user);

			expect(bookmarks).toHaveLength(1);
			expect(bookmarks[0]?.type).toBe('easy');
		});

		it('answers 404 for an exercise outside the catalogue and stores nothing', async () => {
			const filing = useCase.execute(user, UNKNOWN_PUZZLE, { type: 'hard', eventUuid: uuid() });

			await expect(filing).rejects.toThrow(NotFoundException);
			expect(await entityManager.fork().count(PuzzleBookmark, {})).toStrictEqual(0);
			expect(await entityManager.fork().count(PuzzleBookmarkHistory, {})).toStrictEqual(0);
		});

		it("does not touch somebody else's list", async () => {
			const other = await seedUser(entityManager, 'other');

			await useCase.execute(other, SET_PUZZLE, { type: 'easy', updatedAt: OLD });
			await useCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: NEW });
			await useCase.execute(user, SPARE_PUZZLE, { type: 'unclear', updatedAt: NEW });

			const theirs = await listUseCase.execute(other);

			expect(theirs).toHaveLength(1);
			expect(theirs[0]).toMatchObject({ lichessId: SET_PUZZLE, type: 'easy' });
			expect(await listUseCase.execute(user)).toHaveLength(2);
		});
	});

	describe('the history', () => {
		it('records the filing as an event under the uuid the device gave it', async () => {
			const eventUuid = uuid();
			const attemptUuid = uuid();

			await useCase.execute(user, SET_PUZZLE, {
				type: 'hard',
				eventUuid,
				attemptUuid,
				updatedAt: OLD,
			});

			expect(await historyUseCase.execute(user)).toStrictEqual([
				{
					uuid: eventUuid,
					lichessId: SET_PUZZLE,
					type: 'hard',
					attemptUuid,
					createdAt: OLD.toISOString(),
				},
			]);
		});

		it('records an event even when the device sends no uuid for it', async () => {
			await useCase.execute(user, SET_PUZZLE, { type: 'favorite', updatedAt: OLD });

			const history = await historyUseCase.execute(user);

			expect(history).toHaveLength(1);
			expect(history[0]).toMatchObject({ lichessId: SET_PUZZLE, type: 'favorite' });
		});

		it('records a filing dated in the future at the server clock', async () => {
			const before = Date.now();

			await useCase.execute(user, SET_PUZZLE, {
				type: 'hard',
				eventUuid: uuid(),
				updatedAt: FUTURE,
			});

			const [filing] = await historyUseCase.execute(user);

			expect(new Date(filing?.createdAt ?? 0).getTime()).toBeGreaterThanOrEqual(before);
			expect(new Date(filing?.createdAt ?? 0).getTime()).toBeLessThanOrEqual(Date.now());
		});

		it('records the same event only once when it is sent again', async () => {
			const eventUuid = uuid();

			await useCase.execute(user, SET_PUZZLE, { type: 'hard', eventUuid, updatedAt: OLD });
			await useCase.execute(user, SET_PUZZLE, { type: 'hard', eventUuid, updatedAt: OLD });

			expect(await historyUseCase.execute(user)).toHaveLength(1);
			expect(await listUseCase.execute(user)).toHaveLength(1);
		});

		it('keeps an older filing in the history although it lost the current list', async () => {
			const newer = uuid();
			const older = uuid();

			await useCase.execute(user, SET_PUZZLE, { type: 'hard', eventUuid: newer, updatedAt: NEW });
			await useCase.execute(user, SET_PUZZLE, { type: 'easy', eventUuid: older, updatedAt: OLD });

			const history = await historyUseCase.execute(user);

			expect(history.map((event) => event.uuid)).toStrictEqual([older, newer]);
			expect(history.map((event) => event.type)).toStrictEqual(['easy', 'hard']);
		});

		it("does not list somebody else's events", async () => {
			const other = await seedUser(entityManager, 'other');

			await useCase.execute(other, SET_PUZZLE, { type: 'easy', eventUuid: uuid() });

			expect(await historyUseCase.execute(user)).toStrictEqual([]);
		});
	});
});

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
import { PuzzleBookmarkModule } from '../puzzle-bookmark.module';

import { DeletePuzzleBookmarkUseCase } from './delete-puzzle-bookmark.use-case';
import { ListPuzzleBookmarkHistoryUseCase } from './list-puzzle-bookmark-history.use-case';
import { ListPuzzleBookmarksUseCase } from './list-puzzle-bookmarks.use-case';
import { UpsertPuzzleBookmarkUseCase } from './upsert-puzzle-bookmark.use-case';

const OLD = new Date('2026-08-01T10:00:00.000Z');
const NEW = new Date('2026-08-02T10:00:00.000Z');
const FUTURE = new Date('2099-01-01T00:00:00.000Z');

describe('DeletePuzzleBookmarkUseCase', () => {
	let module: TestingModule;
	let entityManager: EntityManager;
	let useCase: DeletePuzzleBookmarkUseCase;
	let upsertUseCase: UpsertPuzzleBookmarkUseCase;
	let listUseCase: ListPuzzleBookmarksUseCase;
	let historyUseCase: ListPuzzleBookmarkHistoryUseCase;
	let user: User;

	beforeAll(async () => {
		module = await createIntegrationTestingModule({ imports: [AppModule, PuzzleBookmarkModule] });

		entityManager = module.get(EntityManager);
		useCase = module.get(DeletePuzzleBookmarkUseCase);
		upsertUseCase = module.get(UpsertPuzzleBookmarkUseCase);
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
		it('unfiles an exercise', async () => {
			await upsertUseCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: OLD });

			await useCase.execute(user, SET_PUZZLE, { updatedAt: NEW });

			expect(await listUseCase.execute(user)).toStrictEqual([]);
		});

		it('is not an error to unfile an exercise that was never filed', async () => {
			await expect(useCase.execute(user, SET_PUZZLE, { updatedAt: NEW })).resolves.toBeUndefined();
			expect(await listUseCase.execute(user)).toStrictEqual([]);
		});

		it('does not let an older removal take out a newer filing', async () => {
			await upsertUseCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: NEW });

			await useCase.execute(user, SET_PUZZLE, { updatedAt: OLD });

			const bookmarks = await listUseCase.execute(user);

			expect(bookmarks).toHaveLength(1);
			expect(bookmarks[0]).toMatchObject({ type: 'hard', updatedAt: NEW.toISOString() });
		});

		it('takes out a filing made at the same instant as the removal', async () => {
			await upsertUseCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: NEW });

			await useCase.execute(user, SET_PUZZLE, { updatedAt: NEW });

			expect(await listUseCase.execute(user)).toStrictEqual([]);
		});

		it('unfiles at the server clock when the device sends no date', async () => {
			await upsertUseCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: OLD });

			await useCase.execute(user, SET_PUZZLE, {});

			expect(await listUseCase.execute(user)).toStrictEqual([]);
		});

		it('does not let a filing from a device running ahead survive a later removal', async () => {
			await upsertUseCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: FUTURE });

			await useCase.execute(user, SET_PUZZLE, { updatedAt: new Date() });

			expect(await listUseCase.execute(user)).toStrictEqual([]);
		});

		it('leaves the other exercises of the list alone', async () => {
			await upsertUseCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: OLD });
			await upsertUseCase.execute(user, SPARE_PUZZLE, { type: 'hard', updatedAt: OLD });

			await useCase.execute(user, SET_PUZZLE, { updatedAt: NEW });

			const bookmarks = await listUseCase.execute(user);

			expect(bookmarks.map((bookmark) => bookmark.lichessId)).toStrictEqual([SPARE_PUZZLE]);
		});

		it("does not take the exercise out of somebody else's list", async () => {
			const other = await seedUser(entityManager, 'other');

			await upsertUseCase.execute(other, SET_PUZZLE, { type: 'easy', updatedAt: OLD });
			await upsertUseCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: OLD });

			await useCase.execute(user, SET_PUZZLE, { updatedAt: NEW });

			expect(await listUseCase.execute(other)).toHaveLength(1);
			expect(await listUseCase.execute(user)).toStrictEqual([]);
		});

		it('answers 404 for an exercise outside the catalogue', async () => {
			const removal = useCase.execute(user, UNKNOWN_PUZZLE, { eventUuid: uuid() });

			await expect(removal).rejects.toThrow(NotFoundException);
			expect(await historyUseCase.execute(user)).toStrictEqual([]);
		});
	});

	describe('the history', () => {
		it('records the removal as an event with no list', async () => {
			const eventUuid = uuid();
			const attemptUuid = uuid();

			await upsertUseCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: OLD });
			await useCase.execute(user, SET_PUZZLE, { eventUuid, attemptUuid, updatedAt: NEW });

			const history = await historyUseCase.execute(user);

			expect(history.at(-1)).toStrictEqual({
				uuid: eventUuid,
				lichessId: SET_PUZZLE,
				type: null,
				attemptUuid,
				createdAt: NEW.toISOString(),
			});
		});

		it('keeps the filing and the removal in the order they happened', async () => {
			const filing = uuid();
			const removal = uuid();

			await upsertUseCase.execute(user, SET_PUZZLE, {
				type: 'hard',
				eventUuid: filing,
				updatedAt: OLD,
			});
			await useCase.execute(user, SET_PUZZLE, { eventUuid: removal, updatedAt: NEW });

			const history = await historyUseCase.execute(user);

			expect(history.map((event) => [event.uuid, event.type])).toStrictEqual([
				[filing, 'hard'],
				[removal, null],
			]);
		});

		it('records a removal with no date at the server clock', async () => {
			const before = Date.now();

			await useCase.execute(user, SET_PUZZLE, { eventUuid: uuid() });

			const [removal] = await historyUseCase.execute(user);

			expect(removal?.type).toBeNull();
			expect(new Date(removal?.createdAt ?? 0).getTime()).toBeGreaterThanOrEqual(before);
			expect(new Date(removal?.createdAt ?? 0).getTime()).toBeLessThanOrEqual(Date.now());
		});

		it('records a removal dated in the future at the server clock', async () => {
			const before = Date.now();

			await useCase.execute(user, SET_PUZZLE, { eventUuid: uuid(), updatedAt: FUTURE });

			const [removal] = await historyUseCase.execute(user);

			expect(new Date(removal?.createdAt ?? 0).getTime()).toBeGreaterThanOrEqual(before);
			expect(new Date(removal?.createdAt ?? 0).getTime()).toBeLessThanOrEqual(Date.now());
		});

		it('keeps a removal from a device running ahead before a later filing', async () => {
			const removal = uuid();
			const filing = uuid();

			await useCase.execute(user, SET_PUZZLE, { eventUuid: removal, updatedAt: FUTURE });
			await upsertUseCase.execute(user, SET_PUZZLE, {
				type: 'hard',
				eventUuid: filing,
				updatedAt: new Date(),
			});

			const recorded = new Map(
				(await historyUseCase.execute(user)).map((event) => [
					event.uuid,
					new Date(event.createdAt).getTime(),
				]),
			);

			expect(recorded.get(removal)).toBeLessThanOrEqual(recorded.get(filing) ?? 0);
			expect(await listUseCase.execute(user)).toHaveLength(1);
		});

		it('records the same removal only once when it is sent again', async () => {
			const eventUuid = uuid();

			await upsertUseCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: OLD });
			await useCase.execute(user, SET_PUZZLE, { eventUuid, updatedAt: NEW });
			await useCase.execute(user, SET_PUZZLE, { eventUuid, updatedAt: NEW });

			const removals = (await historyUseCase.execute(user)).filter((event) => null === event.type);

			expect(removals).toHaveLength(1);
		});

		it('keeps an older removal in the history although the filing outlived it', async () => {
			const removal = uuid();

			await upsertUseCase.execute(user, SET_PUZZLE, { type: 'hard', updatedAt: NEW });
			await useCase.execute(user, SET_PUZZLE, { eventUuid: removal, updatedAt: OLD });

			const history = await historyUseCase.execute(user);

			expect(history[0]).toMatchObject({ uuid: removal, type: null });
		});
	});
});

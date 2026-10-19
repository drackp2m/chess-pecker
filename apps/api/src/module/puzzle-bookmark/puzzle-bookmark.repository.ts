import type { EntityManager } from '@mikro-orm/core';

import { CustomRepository } from '../../shared/util/custom-entity.repository';
import { Puzzle } from '../puzzle/puzzle.entity';
import { User } from '../user/user.entity';

import { PuzzleBookmarkType } from './definition/puzzle-bookmark-type.enum';
import { PuzzleBookmarkHistory } from './puzzle-bookmark-history.entity';
import { PuzzleBookmark } from './puzzle-bookmark.entity';

interface BookmarkEvent {
	readonly user: User;
	readonly puzzle: Puzzle;
	readonly createdAt: Date;
	readonly type?: PuzzleBookmarkType;
	readonly eventUuid?: string;
	readonly attemptUuid?: string;
}

export class PuzzleBookmarkRepository extends CustomRepository<PuzzleBookmark> {
	/**
	 * `insert … on conflict do update`: filing the same exercise twice moves the row instead
	 * of failing, and two devices doing it at once do not race over a read.
	 */
	async upsertByPuzzle(
		bookmark: PuzzleBookmark,
		eventUuid?: string,
		attemptUuid?: string,
	): Promise<PuzzleBookmark> {
		return this.entityManager.transactional(async (entityManager) => {
			await this.recordEvent(entityManager, {
				user: bookmark.user,
				puzzle: bookmark.puzzle,
				type: bookmark.type,
				createdAt: bookmark.updatedAt,
				...(undefined === eventUuid ? {} : { eventUuid }),
				...(undefined === attemptUuid ? {} : { attemptUuid }),
			});

			return this.writeCurrent(entityManager, bookmark, attemptUuid);
		});
	}

	async deleteByPuzzle(
		userUuid: string,
		puzzleUuid: string,
		removedAt: Date,
		eventUuid?: string,
		attemptUuid?: string,
	): Promise<void> {
		await this.entityManager.transactional(async (entityManager) => {
			await this.recordEvent(entityManager, {
				user: entityManager.getReference(User, userUuid),
				puzzle: entityManager.getReference(Puzzle, puzzleUuid),
				createdAt: removedAt,
				...(undefined === eventUuid ? {} : { eventUuid }),
				...(undefined === attemptUuid ? {} : { attemptUuid }),
			});

			await entityManager.nativeDelete(PuzzleBookmark, {
				user: userUuid,
				puzzle: puzzleUuid,
				updatedAt: { $lte: removedAt },
			});
		});
	}

	getHistory(userUuid: string): Promise<PuzzleBookmarkHistory[]> {
		return this.entityManager
			.fork()
			.find(
				PuzzleBookmarkHistory,
				{ user: userUuid },
				{ populate: ['puzzle'], orderBy: { createdAt: 'asc', uuid: 'asc' } },
			);
	}

	private async writeCurrent(
		entityManager: EntityManager,
		bookmark: PuzzleBookmark,
		attemptUuid?: string,
	): Promise<PuzzleBookmark> {
		await entityManager.upsert(
			PuzzleBookmark,
			{
				uuid: bookmark.uuid,
				createdAt: bookmark.createdAt,
				updatedAt: bookmark.updatedAt,
				user: bookmark.user,
				puzzle: bookmark.puzzle,
				type: bookmark.type,
				...(undefined === attemptUuid ? {} : { attemptUuid }),
			},
			{
				onConflictFields: ['user', 'puzzle'],
				onConflictMergeFields: ['type', 'attemptUuid', 'updatedAt'],
				onConflictWhere: { updatedAt: { $lte: bookmark.updatedAt } },
			},
		);

		return entityManager.findOneOrFail(PuzzleBookmark, {
			user: bookmark.user,
			puzzle: bookmark.puzzle,
		});
	}

	private async recordEvent(entityManager: EntityManager, event: BookmarkEvent): Promise<void> {
		const { eventUuid, ...fields } = event;

		if (
			undefined !== eventUuid &&
			null !== (await entityManager.findOne(PuzzleBookmarkHistory, { uuid: eventUuid }))
		) {
			return;
		}

		await entityManager
			.persist(
				new PuzzleBookmarkHistory({
					...fields,
					...(undefined === eventUuid ? {} : { uuid: eventUuid }),
				}),
			)
			.flush();
	}
}

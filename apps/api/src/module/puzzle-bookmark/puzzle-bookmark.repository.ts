import type { EntityManager } from '@mikro-orm/core';

import { CustomRepository } from '../../shared/util/custom-entity.repository';
import { Puzzle } from '../puzzle/puzzle.entity';
import { User } from '../user/user.entity';

import { PuzzleBookmarkHistory } from './puzzle-bookmark-history.entity';
import { PuzzleBookmark } from './puzzle-bookmark.entity';

export class PuzzleBookmarkRepository extends CustomRepository<PuzzleBookmark> {
	/**
	 * `insert … on conflict do update`: filing the same exercise twice moves the row instead
	 * of failing, and two devices doing it at once do not race over a read.
	 */
	async upsertByPuzzle(
		bookmark: PuzzleBookmark,
		eventUuid?: string,
		attemptUuid?: string,
		eventCreatedAt?: Date,
	): Promise<PuzzleBookmark> {
		const entityManager = this.entityManager.fork();
		await this.recordEvent(entityManager, bookmark, eventUuid, attemptUuid, eventCreatedAt);

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
			},
		);

		return entityManager.findOneOrFail(PuzzleBookmark, {
			user: bookmark.user,
			puzzle: bookmark.puzzle,
		});
	}

	async deleteByPuzzle(
		userUuid: string,
		puzzleUuid: string,
		attemptUuid?: string,
		createdAt?: Date,
		eventUuid?: string,
	): Promise<void> {
		const entityManager = this.entityManager.fork();
		const puzzle = entityManager.getReference(Puzzle, puzzleUuid);
		const user = entityManager.getReference(User, userUuid);

		await this.recordDeleteEvent(entityManager, user, puzzle, eventUuid, attemptUuid, createdAt);
		await entityManager.nativeDelete(PuzzleBookmark, { user: userUuid, puzzle: puzzleUuid });
	}

	getHistory(userUuid: string): Promise<PuzzleBookmarkHistory[]> {
		return this.entityManager.find(
			PuzzleBookmarkHistory,
			{ user: userUuid },
			{ populate: ['puzzle'], orderBy: { createdAt: 'asc', uuid: 'asc' } },
		);
	}

	private async recordEvent(
		entityManager: EntityManager,
		bookmark: PuzzleBookmark,
		eventUuid?: string,
		attemptUuid?: string,
		eventCreatedAt?: Date,
	): Promise<void> {
		if (
			undefined !== eventUuid &&
			null !== (await entityManager.findOne(PuzzleBookmarkHistory, { uuid: eventUuid }))
		) {
			return;
		}

		entityManager.persist(
			new PuzzleBookmarkHistory({
				...(undefined === eventUuid ? {} : { uuid: eventUuid }),
				user: bookmark.user,
				puzzle: bookmark.puzzle,
				type: bookmark.type,
				...(undefined === eventCreatedAt ? {} : { createdAt: eventCreatedAt }),
				...(undefined === attemptUuid ? {} : { attemptUuid }),
			}),
		);
	}

	private async recordDeleteEvent(
		entityManager: EntityManager,
		user: User,
		puzzle: Puzzle,
		eventUuid?: string,
		attemptUuid?: string,
		createdAt?: Date,
	): Promise<void> {
		if (
			undefined !== eventUuid &&
			null !== (await entityManager.findOne(PuzzleBookmarkHistory, { uuid: eventUuid }))
		) {
			return;
		}

		await entityManager
			.persist(
				new PuzzleBookmarkHistory({
					...(undefined === eventUuid ? {} : { uuid: eventUuid }),
					user,
					puzzle,
					...(undefined === createdAt ? {} : { createdAt }),
					...(undefined === attemptUuid ? {} : { attemptUuid }),
				}),
			)
			.flush();
	}
}

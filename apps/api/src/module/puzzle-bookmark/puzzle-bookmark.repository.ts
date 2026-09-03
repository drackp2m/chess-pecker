import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { PuzzleBookmark } from './puzzle-bookmark.entity';

export class PuzzleBookmarkRepository extends CustomRepository<PuzzleBookmark> {
	/**
	 * `insert … on conflict do update`: filing the same exercise twice moves the row instead
	 * of failing, and two devices doing it at once do not race over a read.
	 */
	async upsertByPuzzle(bookmark: PuzzleBookmark): Promise<PuzzleBookmark> {
		// The data goes in explicitly and not as an instance: from an entity the EntityManager
		// has never seen, `upsert` reads no fields and sends an empty insert.
		const entityManager = this.entityManager.fork();

		await entityManager.upsert(
			PuzzleBookmark,
			{
				uuid: bookmark.uuid,
				createdAt: bookmark.createdAt,
				updatedAt: bookmark.updatedAt,
				user: bookmark.user,
				puzzle: bookmark.puzzle,
				type: bookmark.type,
			},
			{
				onConflictFields: ['user', 'puzzle'],
				onConflictMergeFields: ['type', 'updatedAt'],
			},
		);

		return entityManager.findOneOrFail(PuzzleBookmark, {
			user: bookmark.user,
			puzzle: bookmark.puzzle,
		});
	}
}

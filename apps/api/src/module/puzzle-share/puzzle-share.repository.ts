import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { PuzzleShareAttempt } from './puzzle-share-attempt.entity';
import { PuzzleShareRecipient } from './puzzle-share-recipient.entity';
import { PuzzleShare } from './puzzle-share.entity';

export class PuzzleShareRepository extends CustomRepository<PuzzleShare> {
	/**
	 * The challenge, everyone it goes to and the sender's own answer in one flush, so the
	 * three tables can never disagree about whether a challenge exists.
	 */
	async insertChallenge(
		share: PuzzleShare,
		recipients: PuzzleShareRecipient[],
		attempt: PuzzleShareAttempt | undefined,
	): Promise<PuzzleShare> {
		const entityManager = this.entityManager.fork();

		entityManager.persist(share).persist(recipients);

		if (undefined !== attempt) {
			entityManager.persist(attempt);
		}

		await entityManager.flush();

		return share;
	}

	/**
	 * The replication feed: what the caller sent whose clock has moved since the stamp given,
	 * oldest first, so a device walks it page by page and stops when a page comes back short.
	 * `>=` rather than `>` on purpose — two challenges may share a millisecond, and a row put
	 * twice is a row put once.
	 */
	async getManySentSince(
		senderUuid: string,
		since: Date | undefined,
		limit: number,
	): Promise<PuzzleShare[]> {
		return this.getMany(
			{ sender: senderUuid, ...(undefined === since ? {} : { updatedAt: { $gte: since } }) },
			{
				populate: ['puzzle', 'sender'],
				orderBy: { updatedAt: 'asc', uuid: 'asc' },
				limit,
			},
		);
	}

	/**
	 * The challenge's clock, moved by hand: an answer is a row of its own, and without this
	 * the aggregate would look untouched to whoever mirrors it by `updatedAt`.
	 */
	async touch(uuid: string, updatedAt: Date): Promise<void> {
		await this.entityManager.fork().nativeUpdate(PuzzleShare, { uuid }, { updatedAt });
	}
}

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

	/** Everything the caller sent, newest first, with what it takes to name the exercise. */
	async getManyBySender(senderUuid: string, limit: number): Promise<PuzzleShare[]> {
		return this.getMany(
			{ sender: senderUuid },
			{
				populate: ['puzzle', 'sender'],
				orderBy: { createdAt: 'desc', uuid: 'desc' },
				limit,
			},
		);
	}
}

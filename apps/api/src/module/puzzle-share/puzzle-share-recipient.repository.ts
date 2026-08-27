import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { PuzzleShareRecipient } from './puzzle-share-recipient.entity';

export class PuzzleShareRecipientRepository extends CustomRepository<PuzzleShareRecipient> {
	/**
	 * The challenges that reached the caller. The row is the addressing and the challenge
	 * hangs off it, so this is what "received" is a list of.
	 */
	async getManyByRecipient(recipientUuid: string, limit: number): Promise<PuzzleShareRecipient[]> {
		return this.getMany(
			{ recipient: recipientUuid },
			{
				populate: ['recipient', 'share', 'share.puzzle', 'share.sender'],
				orderBy: { createdAt: 'desc', uuid: 'desc' },
				limit,
			},
		);
	}

	/** Everyone a batch of challenges went to, in one trip, so a list does not query per row. */
	async getManyByShares(shareUuids: string[]): Promise<PuzzleShareRecipient[]> {
		if (0 === shareUuids.length) {
			return [];
		}

		return this.getMany(
			{ share: { $in: shareUuids } },
			{ populate: ['recipient'], orderBy: { createdAt: 'asc', uuid: 'asc' } },
		);
	}
}

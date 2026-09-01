import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { PuzzleShareAttempt } from './puzzle-share-attempt.entity';

export class PuzzleShareAttemptRepository extends CustomRepository<PuzzleShareAttempt> {
	/** Every answer to a batch of challenges, in one trip, for the same reason as the rows. */
	async getManyByShares(shareUuids: string[]): Promise<PuzzleShareAttempt[]> {
		if (0 === shareUuids.length) {
			return [];
		}

		return this.getMany({ share: { $in: shareUuids } }, { populate: ['user'] });
	}
}

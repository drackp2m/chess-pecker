import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { FriendshipStatus } from './definition/friendship-status.enum';
import { Friendship } from './friendship.entity';

export class FriendshipRepository extends CustomRepository<Friendship> {
	/**
	 * The live request between two people, if there is one, looked up both ways round: the
	 * partial unique index is what guarantees there is at most one.
	 */
	async getActiveBetween(oneUuid: string, otherUuid: string): Promise<Friendship | undefined> {
		const friendships = await this.getMany({
			status: { $in: [FriendshipStatus.Pending, FriendshipStatus.Accepted] },
			$or: [
				{ requester: oneUuid, addressee: otherUuid },
				{ requester: otherUuid, addressee: oneUuid },
			],
		});

		return 0 < friendships.length ? friendships[0] : undefined;
	}

	async getManyByUserAndStatus(userUuid: string, status: FriendshipStatus): Promise<Friendship[]> {
		return this.getMany(
			{
				status,
				$or: [{ requester: userUuid }, { addressee: userUuid }],
			},
			{ populate: ['requester', 'addressee'] },
		);
	}
}

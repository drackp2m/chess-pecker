import { Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { FriendshipStatus } from '../definition/friendship-status.enum';
import { FriendshipRepository } from '../friendship.repository';

@Injectable()
export class ListFriendsUseCase {
	constructor(private readonly friendshipRepository: FriendshipRepository) {}

	/**
	 * The row says who asked and who received, not who the friend is, so "the other one" is
	 * resolved here once instead of in every query that needs the list.
	 */
	async execute(user: User): Promise<User[]> {
		const friendships = await this.friendshipRepository.getManyByUserAndStatus(
			user.uuid,
			FriendshipStatus.Accepted,
		);

		return friendships.map((friendship) =>
			friendship.requester.uuid === user.uuid ? friendship.addressee : friendship.requester,
		);
	}
}

import { Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { FriendshipStatus } from '../definition/friendship-status.enum';
import { Friendship } from '../friendship.entity';
import { FriendshipRepository } from '../friendship.repository';

@Injectable()
export class ListFriendRequestsUseCase {
	constructor(private readonly friendshipRepository: FriendshipRepository) {}

	async execute(user: User): Promise<{ received: Friendship[]; sent: Friendship[] }> {
		const pending = await this.friendshipRepository.getManyByUserAndStatus(
			user.uuid,
			FriendshipStatus.Pending,
		);

		return {
			received: pending.filter((friendship) => friendship.addressee.uuid === user.uuid),
			sent: pending.filter((friendship) => friendship.requester.uuid === user.uuid),
		};
	}
}

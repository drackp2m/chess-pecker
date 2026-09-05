import { Inject, Injectable } from '@nestjs/common';

import { NotFoundException } from '../../../shared/exception/not-found.exception';
import { User } from '../../user/user.entity';
import { FriendshipRepository } from '../friendship.repository';

@Injectable()
export class RemoveFriendshipByUserUseCase {
	constructor(
		@Inject(FriendshipRepository)
		private readonly friendshipRepository: FriendshipRepository,
	) {}

	/**
	 * The same removal as `RemoveFriendshipUseCase` by the other person, since the row uuid
	 * never reaches the client. The partial unique index makes "the friendship with X" exact.
	 */
	async execute(user: User, otherUserUuid: string): Promise<void> {
		const friendship = await this.friendshipRepository.getActiveBetween(user.uuid, otherUserUuid);

		if (undefined === friendship) {
			throw new NotFoundException('not exists', 'friendship');
		}

		await this.friendshipRepository.delete(friendship);
	}
}

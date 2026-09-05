import { Inject, Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { User } from '../../user/user.entity';
import { FriendshipStatus } from '../definition/friendship-status.enum';
import { Friendship } from '../friendship.entity';
import { FriendshipRepository } from '../friendship.repository';

@Injectable()
export class AnswerFriendRequestUseCase {
	constructor(
		@Inject(FriendshipRepository)
		private readonly friendshipRepository: FriendshipRepository,
	) {}

	async execute(
		user: User,
		friendshipUuid: string,
		status: FriendshipStatus.Accepted | FriendshipStatus.Declined,
	): Promise<Friendship> {
		const friendship = await this.friendshipRepository.getOne({ uuid: friendshipUuid });

		// Only the addressee answers; the sender cancels instead, which is a delete.
		if (friendship.addressee.uuid !== user.uuid) {
			throw new ForbiddenException('not allowed', 'friendship');
		}

		if (FriendshipStatus.Pending !== friendship.status) {
			throw new PreconditionFailedException('already answered', 'friendship');
		}

		friendship.status = status;

		return this.friendshipRepository.update(friendship);
	}
}

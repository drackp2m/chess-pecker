import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { User } from '../../user/user.entity';
import { FriendshipRepository } from '../friendship.repository';

@Injectable()
export class RemoveFriendshipUseCase {
	constructor(private readonly friendshipRepository: FriendshipRepository) {}

	/**
	 * Unfriending, and cancelling an unanswered request. The row is deleted rather than
	 * marked, so the pair is free to ask again without hitting the partial unique index.
	 */
	async execute(user: User, friendshipUuid: string): Promise<void> {
		const friendship = await this.friendshipRepository.getOne({ uuid: friendshipUuid });

		const isInvolved =
			friendship.requester.uuid === user.uuid || friendship.addressee.uuid === user.uuid;

		if (!isInvolved) {
			throw new ForbiddenException('not allowed', 'friendship');
		}

		await this.friendshipRepository.delete(friendship);
	}
}

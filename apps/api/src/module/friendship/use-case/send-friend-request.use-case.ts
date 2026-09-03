import type { SendFriendRequest } from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { User } from '../../user/user.entity';
import { UserRepository } from '../../user/user.repository';
import { Friendship } from '../friendship.entity';
import { FriendshipRepository } from '../friendship.repository';
import { UserBlockRepository } from '../user-block.repository';

@Injectable()
export class SendFriendRequestUseCase {
	constructor(
		private readonly friendshipRepository: FriendshipRepository,
		private readonly userRepository: UserRepository,
		private readonly userBlockRepository: UserBlockRepository,
	) {}

	async execute(requester: User, sendRequest: SendFriendRequest): Promise<Friendship> {
		const addressee = await this.userRepository.getOne({ username: sendRequest.username });

		if (addressee.uuid === requester.uuid) {
			throw new PreconditionFailedException('cannot be yourself', 'username');
		}

		if (await this.userBlockRepository.existsBetween(requester.uuid, addressee.uuid)) {
			// Without saying who blocked whom, which would confirm the block to the blocked.
			throw new ForbiddenException('not allowed', 'friendship');
		}

		// Rejected ones do not count, since asking again is allowed; pending and accepted do,
		// and the partial unique index holds even for two requests arriving at once.
		if (
			undefined !==
			(await this.friendshipRepository.getActiveBetween(requester.uuid, addressee.uuid))
		) {
			throw new PreconditionFailedException('already exists', 'friendship');
		}

		return this.friendshipRepository.insert(new Friendship({ requester, addressee }));
	}
}

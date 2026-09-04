import type { BlockUserRequest } from '@chesspecker/api-definitions';
import { Inject, Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { User } from '../../user/user.entity';
import { UserRepository } from '../../user/user.repository';
import { FriendshipRepository } from '../friendship.repository';
import { UserBlock } from '../user-block.entity';
import { UserBlockRepository } from '../user-block.repository';

@Injectable()
export class BlockUserUseCase {
	constructor(
		@Inject(UserBlockRepository)
		private readonly userBlockRepository: UserBlockRepository,
		@Inject(UserRepository)
		private readonly userRepository: UserRepository,
		@Inject(FriendshipRepository)
		private readonly friendshipRepository: FriendshipRepository,
	) {}

	async execute(blocker: User, blockRequest: BlockUserRequest): Promise<UserBlock> {
		const blocked = await this.userRepository.getOne({ username: blockRequest.username });

		if (blocked.uuid === blocker.uuid) {
			throw new PreconditionFailedException('cannot be yourself', 'username');
		}

		const existing = await this.userBlockRepository.getMany({
			blocker: blocker.uuid,
			blocked: blocked.uuid,
		});

		if (0 < existing.length) {
			throw new PreconditionFailedException('already exists', 'block');
		}

		// Blocking breaks whatever relation existed: the row is deleted rather than left
		// rejected, since the block already prevents asking again.
		const friendship = await this.friendshipRepository.getActiveBetween(blocker.uuid, blocked.uuid);

		if (undefined !== friendship) {
			await this.friendshipRepository.delete(friendship);
		}

		return this.userBlockRepository.insert(new UserBlock({ blocker, blocked }));
	}
}

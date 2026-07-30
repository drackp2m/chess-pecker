import { Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { User } from '../../user/user.entity';
import { UserRepository } from '../../user/user.repository';
import { BlockUserRequestDto } from '../dto/request/block-user-request.dto';
import { FriendshipRepository } from '../friendship.repository';
import { UserBlock } from '../user-block.entity';
import { UserBlockRepository } from '../user-block.repository';

@Injectable()
export class BlockUserUseCase {
	constructor(
		private readonly userBlockRepository: UserBlockRepository,
		private readonly userRepository: UserRepository,
		private readonly friendshipRepository: FriendshipRepository,
	) {}

	async execute(blocker: User, blockRequest: BlockUserRequestDto): Promise<UserBlock> {
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

		// Bloquear rompe la relación que hubiera: la fila se borra en lugar de quedarse
		// rechazada, porque quien bloquea no quiere el rastro y el bloqueo ya impide volver.
		const friendship = await this.friendshipRepository.getActiveBetween(blocker.uuid, blocked.uuid);

		if (undefined !== friendship) {
			await this.friendshipRepository.delete(friendship);
		}

		return this.userBlockRepository.insert(new UserBlock({ blocker, blocked }));
	}
}

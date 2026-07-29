import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { User } from '../../user/user.entity';
import { UserRepository } from '../../user/user.repository';
import { SendFriendRequestDto } from '../dto/request/send-friend-request.dto';
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

	async execute(requester: User, sendRequest: SendFriendRequestDto): Promise<Friendship> {
		const addressee = await this.userRepository.getOne({ username: sendRequest.username });

		if (addressee.uuid === requester.uuid) {
			throw new PreconditionFailedException('cannot be yourself', 'username');
		}

		if (await this.userBlockRepository.existsBetween(requester.uuid, addressee.uuid)) {
			// Sin detallar quién bloqueó a quién: decirlo confirmaría al bloqueado que lo está.
			throw new ForbiddenException('not allowed', 'friendship');
		}

		// Las rechazadas no cuentan: se puede volver a pedir. Las pendientes y las aceptadas
		// sí, y el índice único parcial lo garantiza aunque dos peticiones lleguen a la vez.
		if (
			undefined !==
			(await this.friendshipRepository.getActiveBetween(requester.uuid, addressee.uuid))
		) {
			throw new PreconditionFailedException('already exists', 'friendship');
		}

		return this.friendshipRepository.insert(new Friendship({ requester, addressee }));
	}
}

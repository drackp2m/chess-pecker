import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { User } from '../../user/user.entity';
import { FriendshipRepository } from '../friendship.repository';

@Injectable()
export class RemoveFriendshipUseCase {
	constructor(private readonly friendshipRepository: FriendshipRepository) {}

	/**
	 * Sirve para dejar de ser amigos y para cancelar una solicitud que aún no han contestado.
	 * Borra la fila en lugar de marcarla, para que el par vuelva a quedar libre y se pueda
	 * volver a pedir sin chocar con el índice único parcial.
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

import { Injectable } from '@nestjs/common';

import { NotFoundException } from '../../../shared/exception/not-found.exception';
import { User } from '../../user/user.entity';
import { FriendshipRepository } from '../friendship.repository';

@Injectable()
export class RemoveFriendshipByUserUseCase {
	constructor(private readonly friendshipRepository: FriendshipRepository) {}

	/**
	 * La misma baja que `RemoveFriendshipUseCase`, identificando la relación por la otra
	 * persona en lugar de por la fila: `GET /friendship` devuelve usuarios, no filas, así que
	 * el uuid de la amistad no llega al cliente y sin esto la única salida de una amistad
	 * sería bloquear.
	 *
	 * El índice único parcial garantiza que entre dos personas hay como mucho una fila viva,
	 * de modo que «la amistad con X» no es ambiguo. Vale igual para cancelar una solicitud
	 * pendiente, que es la otra cosa que esa fila puede ser.
	 */
	async execute(user: User, otherUserUuid: string): Promise<void> {
		const friendship = await this.friendshipRepository.getActiveBetween(user.uuid, otherUserUuid);

		if (undefined === friendship) {
			throw new NotFoundException('not exists', 'friendship');
		}

		await this.friendshipRepository.delete(friendship);
	}
}

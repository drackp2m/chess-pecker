import { Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { FriendshipStatus } from '../definition/friendship-status.enum';
import { FriendshipRepository } from '../friendship.repository';

@Injectable()
export class ListFriendsUseCase {
	constructor(private readonly friendshipRepository: FriendshipRepository) {}

	/**
	 * La fila no dice quién es el amigo: dice quién pidió y quién recibió. El "el otro de
	 * los dos" se resuelve aquí una vez, y no en cada consulta que necesite la lista.
	 */
	async execute(user: User): Promise<User[]> {
		const friendships = await this.friendshipRepository.getManyByUserAndStatus(
			user.uuid,
			FriendshipStatus.Accepted,
		);

		return friendships.map((friendship) =>
			friendship.requester.uuid === user.uuid ? friendship.addressee : friendship.requester,
		);
	}
}

import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { Avatar, User } from './user.entity';

export class UserRepository extends CustomRepository<User> {
	findActiveUsers(): User[] {
		return [];
	}

	async updateAvatar(uuid: string, avatar: Avatar): Promise<void> {
		const entityManager = this.entityManager.fork();
		const user = await entityManager.findOneOrFail(User, { uuid });

		user.avatar = avatar;
		await entityManager.flush();
	}
}

import { Inject, Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { UserBlock } from '../user-block.entity';
import { UserBlockRepository } from '../user-block.repository';

@Injectable()
export class ListBlockedUsersUseCase {
	constructor(
		@Inject(UserBlockRepository)
		private readonly userBlockRepository: UserBlockRepository,
	) {}

	async execute(user: User): Promise<UserBlock[]> {
		return this.userBlockRepository.getMany({ blocker: user.uuid }, { populate: ['blocked'] });
	}
}

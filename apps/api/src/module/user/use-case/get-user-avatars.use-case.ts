import type { GetUserAvatarsRequestParsed, UserAvatar } from '@chesspecker/api-definitions';
import { Inject, Injectable } from '@nestjs/common';

import { UserRepository } from '../user.repository';
import { presentUserAvatar } from '../util/user-summary.util';

@Injectable()
export class GetUserAvatarsUseCase {
	constructor(
		@Inject(UserRepository)
		private readonly userRepository: UserRepository,
	) {}

	async execute(request: GetUserAvatarsRequestParsed): Promise<UserAvatar[]> {
		const users = await this.userRepository.getMany({ uuid: { $in: [...new Set(request.uuids)] } });

		return users.map(presentUserAvatar);
	}
}

import type { Avatar as AvatarResponse, UpdateAvatarRequest } from '@chesspecker/api-definitions';
import { Inject, Injectable } from '@nestjs/common';

import { Avatar, User } from '../user.entity';
import { UserRepository } from '../user.repository';
import { toAvatarResponse } from '../util/user-summary.util';

@Injectable()
export class UpdateAvatarUseCase {
	constructor(
		@Inject(UserRepository)
		private readonly userRepository: UserRepository,
	) {}

	async execute(currentUser: User, request: UpdateAvatarRequest): Promise<AvatarResponse> {
		const avatar = new Avatar(request);

		await this.userRepository.updateAvatar(currentUser.uuid, avatar);

		return toAvatarResponse(avatar);
	}
}

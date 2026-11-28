import { avatarSchema, searchUserRequestSchema } from '@chesspecker/api-definitions';
import type {
	Avatar,
	SearchUserRequest,
	UpdateAvatarRequest,
	UserSummary,
} from '@chesspecker/api-definitions';
import { Body, Controller, Get, Inject, Patch, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';

import { SearchUsersUseCase } from './use-case/search-users.use-case';
import { UpdateAvatarUseCase } from './use-case/update-avatar.use-case';
import { User } from './user.entity';

@Controller('user')
export class UserController {
	constructor(
		@Inject(SearchUsersUseCase)
		private readonly searchUsersUseCase: SearchUsersUseCase,
		@Inject(UpdateAvatarUseCase)
		private readonly updateAvatarUseCase: UpdateAvatarUseCase,
	) {}

	@Get()
	async search(
		@CurrentUser() user: User,
		@Query({ schema: searchUserRequestSchema }) search: SearchUserRequest,
	): Promise<UserSummary[]> {
		return this.searchUsersUseCase.execute(user, search);
	}

	@Patch('avatar')
	async updateAvatar(
		@CurrentUser() user: User,
		@Body({ schema: avatarSchema }) request: UpdateAvatarRequest,
	): Promise<Avatar> {
		return this.updateAvatarUseCase.execute(user, request);
	}
}

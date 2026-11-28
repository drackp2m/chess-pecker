import {
	avatarSchema,
	getUserAvatarsRequestSchema,
	searchUserRequestSchema,
} from '@chesspecker/api-definitions';
import type {
	Avatar,
	GetUserAvatarsRequestParsed,
	PublicUser,
	SearchUserRequest,
	UpdateAvatarRequest,
	UserAvatar,
} from '@chesspecker/api-definitions';
import { Body, Controller, Get, Inject, Patch, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';

import { GetUserAvatarsUseCase } from './use-case/get-user-avatars.use-case';
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
		@Inject(GetUserAvatarsUseCase)
		private readonly getUserAvatarsUseCase: GetUserAvatarsUseCase,
	) {}

	@Get()
	async search(
		@CurrentUser() user: User,
		@Query({ schema: searchUserRequestSchema }) search: SearchUserRequest,
	): Promise<PublicUser[]> {
		return this.searchUsersUseCase.execute(user, search);
	}

	@Get('avatar')
	async getAvatars(
		@Query({ schema: getUserAvatarsRequestSchema }) request: GetUserAvatarsRequestParsed,
	): Promise<UserAvatar[]> {
		return this.getUserAvatarsUseCase.execute(request);
	}

	@Patch('avatar')
	async updateAvatar(
		@CurrentUser() user: User,
		@Body({ schema: avatarSchema }) request: UpdateAvatarRequest,
	): Promise<Avatar> {
		return this.updateAvatarUseCase.execute(user, request);
	}
}

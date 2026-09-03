import { searchUserRequestSchema } from '@chesspecker/api-definitions';
import type { SearchUserRequest, UserSummary } from '@chesspecker/api-definitions';
import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';

import { SearchUsersUseCase } from './use-case/search-users.use-case';
import { User } from './user.entity';

@Controller('user')
export class UserController {
	constructor(private readonly searchUsersUseCase: SearchUsersUseCase) {}

	@Get()
	async search(
		@CurrentUser() user: User,
		@Query({ schema: searchUserRequestSchema }) search: SearchUserRequest,
	): Promise<UserSummary[]> {
		return this.searchUsersUseCase.execute(user, search);
	}
}

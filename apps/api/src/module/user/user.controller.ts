import type { UserSummary } from '@chesspecker/api-definitions';
import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';

import { SearchUserRequestDto } from './dto/request/search-user-request.dto';
import { SearchUsersUseCase } from './use-case/search-users.use-case';
import { User } from './user.entity';

@Controller('user')
export class UserController {
	constructor(private readonly searchUsersUseCase: SearchUsersUseCase) {}

	@Get()
	async search(
		@CurrentUser() user: User,
		@Query() search: SearchUserRequestDto,
	): Promise<UserSummary[]> {
		return this.searchUsersUseCase.execute(user, search);
	}
}

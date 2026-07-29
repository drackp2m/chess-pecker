import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { BlockUserRequestDto } from './dto/request/block-user-request.dto';
import { BlockUserUseCase } from './use-case/block-user.use-case';
import { ListBlockedUsersUseCase } from './use-case/list-blocked-users.use-case';
import { UnblockUserUseCase } from './use-case/unblock-user.use-case';
import { UserBlock } from './user-block.entity';

@Controller('user-block')
export class UserBlockController {
	constructor(
		private readonly blockUserUseCase: BlockUserUseCase,
		private readonly unblockUserUseCase: UnblockUserUseCase,
		private readonly listBlockedUsersUseCase: ListBlockedUsersUseCase,
	) {}

	@Get()
	async list(@CurrentUser() user: User): Promise<UserBlock[]> {
		return this.listBlockedUsersUseCase.execute(user);
	}

	@Post()
	async block(
		@CurrentUser() user: User,
		@Body() blockRequest: BlockUserRequestDto,
	): Promise<UserBlock> {
		return this.blockUserUseCase.execute(user, blockRequest);
	}

	@Delete(':uuid')
	@HttpCode(HttpStatus.NO_CONTENT)
	async unblock(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<void> {
		return this.unblockUserUseCase.execute(user, uuid);
	}
}

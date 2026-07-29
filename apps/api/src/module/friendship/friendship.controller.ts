import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { FriendshipStatus } from './definition/friendship-status.enum';
import { SendFriendRequestDto } from './dto/request/send-friend-request.dto';
import { Friendship } from './friendship.entity';
import { AnswerFriendRequestUseCase } from './use-case/answer-friend-request.use-case';
import { ListFriendRequestsUseCase } from './use-case/list-friend-requests.use-case';
import { ListFriendsUseCase } from './use-case/list-friends.use-case';
import { RemoveFriendshipUseCase } from './use-case/remove-friendship.use-case';
import { SendFriendRequestUseCase } from './use-case/send-friend-request.use-case';

@Controller('friendship')
export class FriendshipController {
	constructor(
		private readonly sendFriendRequestUseCase: SendFriendRequestUseCase,
		private readonly answerFriendRequestUseCase: AnswerFriendRequestUseCase,
		private readonly removeFriendshipUseCase: RemoveFriendshipUseCase,
		private readonly listFriendsUseCase: ListFriendsUseCase,
		private readonly listFriendRequestsUseCase: ListFriendRequestsUseCase,
	) {}

	@Get()
	async listFriends(@CurrentUser() user: User): Promise<User[]> {
		return this.listFriendsUseCase.execute(user);
	}

	@Get('request')
	async listRequests(
		@CurrentUser() user: User,
	): Promise<{ received: Friendship[]; sent: Friendship[] }> {
		return this.listFriendRequestsUseCase.execute(user);
	}

	@Post('request')
	async sendRequest(
		@CurrentUser() user: User,
		@Body() sendRequest: SendFriendRequestDto,
	): Promise<Friendship> {
		return this.sendFriendRequestUseCase.execute(user, sendRequest);
	}

	@Patch(':uuid/accept')
	async accept(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<Friendship> {
		return this.answerFriendRequestUseCase.execute(user, uuid, FriendshipStatus.Accepted);
	}

	@Patch(':uuid/decline')
	async decline(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<Friendship> {
		return this.answerFriendRequestUseCase.execute(user, uuid, FriendshipStatus.Declined);
	}

	@Delete(':uuid')
	@HttpCode(HttpStatus.NO_CONTENT)
	async remove(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<void> {
		return this.removeFriendshipUseCase.execute(user, uuid);
	}
}

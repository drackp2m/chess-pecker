import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { UserModule } from '../user/user.module';

import { FriendshipController } from './friendship.controller';
import { Friendship } from './friendship.entity';
import { AnswerFriendRequestUseCase } from './use-case/answer-friend-request.use-case';
import { BlockUserUseCase } from './use-case/block-user.use-case';
import { ListBlockedUsersUseCase } from './use-case/list-blocked-users.use-case';
import { ListFriendRequestsUseCase } from './use-case/list-friend-requests.use-case';
import { ListFriendsUseCase } from './use-case/list-friends.use-case';
import { RemoveFriendshipByUserUseCase } from './use-case/remove-friendship-by-user.use-case';
import { RemoveFriendshipUseCase } from './use-case/remove-friendship.use-case';
import { SendFriendRequestUseCase } from './use-case/send-friend-request.use-case';
import { UnblockUserUseCase } from './use-case/unblock-user.use-case';
import { UserBlockController } from './user-block.controller';
import { UserBlock } from './user-block.entity';

/**
 * Friendship and blocking ship together: each needs the other, so two modules would leave
 * a circular dependency.
 */
@Module({
	imports: [MikroOrmModule.forFeature([Friendship, UserBlock]), UserModule],
	providers: [
		SendFriendRequestUseCase,
		AnswerFriendRequestUseCase,
		RemoveFriendshipUseCase,
		RemoveFriendshipByUserUseCase,
		ListFriendsUseCase,
		ListFriendRequestsUseCase,
		BlockUserUseCase,
		UnblockUserUseCase,
		ListBlockedUsersUseCase,
	],
	// `ListFriendsUseCase` travels because sharing an exercise needs the same list, and
	// "the other one in the row" is not a rule worth resolving twice.
	exports: [MikroOrmModule, ListFriendsUseCase],
	controllers: [FriendshipController, UserBlockController],
})
export class FriendshipModule {}

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
import { RemoveFriendshipUseCase } from './use-case/remove-friendship.use-case';
import { SendFriendRequestUseCase } from './use-case/send-friend-request.use-case';
import { UnblockUserUseCase } from './use-case/unblock-user.use-case';
import { UserBlockController } from './user-block.controller';
import { UserBlock } from './user-block.entity';

/**
 * Amistad y bloqueo van juntos: son dos tablas del mismo grafo social y se necesitan la
 * una a la otra (no se puede pedir amistad a quien te bloqueó, y bloquear borra la
 * amistad que hubiera). Separarlos en dos módulos deja una dependencia circular.
 */
@Module({
	imports: [MikroOrmModule.forFeature([Friendship, UserBlock]), UserModule],
	providers: [
		SendFriendRequestUseCase,
		AnswerFriendRequestUseCase,
		RemoveFriendshipUseCase,
		ListFriendsUseCase,
		ListFriendRequestsUseCase,
		BlockUserUseCase,
		UnblockUserUseCase,
		ListBlockedUsersUseCase,
	],
	exports: [MikroOrmModule],
	controllers: [FriendshipController, UserBlockController],
})
export class FriendshipModule {}

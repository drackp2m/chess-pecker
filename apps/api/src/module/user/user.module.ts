import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { GetUserAvatarsUseCase } from './use-case/get-user-avatars.use-case';
import { SearchUsersUseCase } from './use-case/search-users.use-case';
import { UpdateAvatarUseCase } from './use-case/update-avatar.use-case';
import { UserController } from './user.controller';
import { User } from './user.entity';

@Module({
	imports: [MikroOrmModule.forFeature([User])],
	providers: [SearchUsersUseCase, UpdateAvatarUseCase, GetUserAvatarsUseCase],
	exports: [MikroOrmModule],
	controllers: [UserController],
})
export class UserModule {}

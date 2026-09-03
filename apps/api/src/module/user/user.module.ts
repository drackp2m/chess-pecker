import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { SearchUsersUseCase } from './use-case/search-users.use-case';
import { UserController } from './user.controller';
import { User } from './user.entity';

@Module({
	imports: [MikroOrmModule.forFeature([User])],
	providers: [SearchUsersUseCase],
	exports: [MikroOrmModule],
	controllers: [UserController],
})
export class UserModule {}

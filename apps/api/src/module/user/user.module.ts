import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { User } from './user.entity';
import { IsUniqueUserPropRule } from './validator/is-unique-user-prop';

@Module({
	imports: [MikroOrmModule.forFeature([User])],
	providers: [IsUniqueUserPropRule],
	exports: [MikroOrmModule],
})
export class UserModule {}

import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ConfigurationModule } from '../../shared/module/config/configuration.module';
import { MikroOrmFactory } from '../../shared/module/config/factory/mikro-orm.factory';
import { apiConfig } from '../../shared/module/config/register/api-config';
import { databaseConfig } from '../../shared/module/config/register/database-config';
import { jwtConfig } from '../../shared/module/config/register/jwt-config';
import { AuthModule } from '../auth/auth.module';
import { FriendshipModule } from '../friendship/friendship.module';
import { PuzzleModule } from '../puzzle/puzzle.module';
import { TrainingModule } from '../training/training.module';
import { UserModule } from '../user/user.module';
import { UserSettingModule } from '../user-setting/user-setting.module';

import { AppController } from './app.controller';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: [databaseConfig, apiConfig, jwtConfig],
		}),
		MikroOrmModule.forRootAsync({
			useClass: MikroOrmFactory,
		}),
		ConfigurationModule,
		AuthModule,
		UserModule,
		UserSettingModule,
		FriendshipModule,
		PuzzleModule,
		TrainingModule,
	],
	controllers: [AppController],
})
export class AppModule {}

import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { DeleteUserSettingUseCase } from './use-case/delete-user-setting.use-case';
import { GetUserSettingsUseCase } from './use-case/get-user-settings.use-case';
import { UpsertUserSettingUseCase } from './use-case/upsert-user-setting.use-case';
import { UserSettingController } from './user-setting.controller';
import { UserSetting } from './user-setting.entity';

@Module({
	imports: [MikroOrmModule.forFeature([UserSetting])],
	providers: [GetUserSettingsUseCase, UpsertUserSettingUseCase, DeleteUserSettingUseCase],
	exports: [MikroOrmModule],
	controllers: [UserSettingController],
})
export class UserSettingModule {}

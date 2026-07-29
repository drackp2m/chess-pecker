import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { UpsertUserSettingRequestDto } from './dto/request/upsert-user-setting-request.dto';
import { DeleteUserSettingUseCase } from './use-case/delete-user-setting.use-case';
import { GetUserSettingsUseCase } from './use-case/get-user-settings.use-case';
import { UpsertUserSettingUseCase } from './use-case/upsert-user-setting.use-case';
import { UserSetting } from './user-setting.entity';

@Controller('user-setting')
export class UserSettingController {
	constructor(
		private readonly getUserSettingsUseCase: GetUserSettingsUseCase,
		private readonly upsertUserSettingUseCase: UpsertUserSettingUseCase,
		private readonly deleteUserSettingUseCase: DeleteUserSettingUseCase,
	) {}

	@Get()
	async getAll(@CurrentUser() user: User): Promise<UserSetting[]> {
		return this.getUserSettingsUseCase.execute(user);
	}

	@Put(':key')
	async upsert(
		@CurrentUser() user: User,
		@Param('key') key: string,
		@Body() upsertRequest: UpsertUserSettingRequestDto,
	): Promise<UserSetting> {
		return this.upsertUserSettingUseCase.execute(user, key, upsertRequest);
	}

	@Delete(':key')
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(@CurrentUser() user: User, @Param('key') key: string): Promise<void> {
		return this.deleteUserSettingUseCase.execute(user, key);
	}
}

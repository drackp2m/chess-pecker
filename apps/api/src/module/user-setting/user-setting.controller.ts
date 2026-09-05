import { upsertUserSettingRequestSchema } from '@chesspecker/api-definitions';
import type { UpsertUserSettingRequest } from '@chesspecker/api-definitions';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	Put,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { DeleteUserSettingUseCase } from './use-case/delete-user-setting.use-case';
import { GetUserSettingsUseCase } from './use-case/get-user-settings.use-case';
import { UpsertUserSettingUseCase } from './use-case/upsert-user-setting.use-case';
import { UserSetting } from './user-setting.entity';

@Controller('user-setting')
export class UserSettingController {
	constructor(
		@Inject(GetUserSettingsUseCase)
		private readonly getUserSettingsUseCase: GetUserSettingsUseCase,
		@Inject(UpsertUserSettingUseCase)
		private readonly upsertUserSettingUseCase: UpsertUserSettingUseCase,
		@Inject(DeleteUserSettingUseCase)
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
		@Body({ schema: upsertUserSettingRequestSchema }) upsertRequest: UpsertUserSettingRequest,
	): Promise<UserSetting> {
		return this.upsertUserSettingUseCase.execute(user, key, upsertRequest);
	}

	@Delete(':key')
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(@CurrentUser() user: User, @Param('key') key: string): Promise<void> {
		return this.deleteUserSettingUseCase.execute(user, key);
	}
}

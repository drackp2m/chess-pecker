import { Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { UpsertUserSettingRequestDto } from '../dto/request/upsert-user-setting-request.dto';
import { UserSetting } from '../user-setting.entity';
import { UserSettingRepository } from '../user-setting.repository';

@Injectable()
export class UpsertUserSettingUseCase {
	constructor(private readonly userSettingRepository: UserSettingRepository) {}

	async execute(
		user: User,
		key: string,
		upsertRequest: UpsertUserSettingRequestDto,
	): Promise<UserSetting> {
		return this.userSettingRepository.upsertByKey(
			new UserSetting({ user, key, value: { value: upsertRequest.value } }),
		);
	}
}

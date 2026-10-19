import type { UpsertUserSettingRequestParsed } from '@chesspecker/api-definitions';
import { Inject, Injectable } from '@nestjs/common';

import { clampToNow } from '../../../shared/util/clamp-to-now';
import { User } from '../../user/user.entity';
import { UserSetting } from '../user-setting.entity';
import { UserSettingRepository } from '../user-setting.repository';

@Injectable()
export class UpsertUserSettingUseCase {
	constructor(
		@Inject(UserSettingRepository)
		private readonly userSettingRepository: UserSettingRepository,
	) {}

	async execute(
		user: User,
		key: string,
		upsertRequest: UpsertUserSettingRequestParsed,
	): Promise<UserSetting> {
		return this.userSettingRepository.upsertByKey(
			new UserSetting({
				user,
				key,
				value: { value: upsertRequest.value },
				updatedAt: clampToNow(upsertRequest.updatedAt),
			}),
		);
	}
}

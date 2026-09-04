import { Inject, Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { UserSetting } from '../user-setting.entity';
import { UserSettingRepository } from '../user-setting.repository';

@Injectable()
export class GetUserSettingsUseCase {
	constructor(
		@Inject(UserSettingRepository)
		private readonly userSettingRepository: UserSettingRepository,
	) {}

	/**
	 * Only the rows that exist. A missing key means the code's default, so the front fills the
	 * gaps and nothing is invented here.
	 */
	async execute(user: User): Promise<UserSetting[]> {
		return this.userSettingRepository.getMany({ user: user.uuid });
	}
}

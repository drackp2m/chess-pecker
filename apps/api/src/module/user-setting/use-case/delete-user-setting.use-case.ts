import { Inject, Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { UserSettingRepository } from '../user-setting.repository';

@Injectable()
export class DeleteUserSettingUseCase {
	constructor(
		@Inject(UserSettingRepository)
		private readonly userSettingRepository: UserSettingRepository,
	) {}

	/**
	 * Deleting a setting returns it to its default, which lives in the code and not as a row,
	 * so a key that never existed is not an error.
	 */
	async execute(user: User, key: string): Promise<void> {
		await this.userSettingRepository.deleteMany({ user: user.uuid, key });
	}
}

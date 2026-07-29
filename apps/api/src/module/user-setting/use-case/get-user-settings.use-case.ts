import { Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { UserSetting } from '../user-setting.entity';
import { UserSettingRepository } from '../user-setting.repository';

@Injectable()
export class GetUserSettingsUseCase {
	constructor(private readonly userSettingRepository: UserSettingRepository) {}

	/**
	 * Devuelve sólo las filas que existen. La ausencia de una clave significa "valor por
	 * defecto del código", así que el front rellena los huecos y aquí no se inventa nada.
	 */
	async execute(user: User): Promise<UserSetting[]> {
		return this.userSettingRepository.getMany({ user: user.uuid });
	}
}

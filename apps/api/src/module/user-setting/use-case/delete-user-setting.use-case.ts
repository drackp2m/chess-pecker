import { Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { UserSettingRepository } from '../user-setting.repository';

@Injectable()
export class DeleteUserSettingUseCase {
	constructor(private readonly userSettingRepository: UserSettingRepository) {}

	/**
	 * Borrar el ajuste es devolverlo a su valor por defecto, porque el defecto vive en el
	 * código y no como fila. Por eso no falla si la clave no existía.
	 */
	async execute(user: User, key: string): Promise<void> {
		await this.userSettingRepository.deleteMany({ user: user.uuid, key });
	}
}

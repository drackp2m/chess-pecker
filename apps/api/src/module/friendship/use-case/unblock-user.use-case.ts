import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { User } from '../../user/user.entity';
import { UserBlockRepository } from '../user-block.repository';

@Injectable()
export class UnblockUserUseCase {
	constructor(private readonly userBlockRepository: UserBlockRepository) {}

	async execute(user: User, blockUuid: string): Promise<void> {
		const block = await this.userBlockRepository.getOne({ uuid: blockUuid });

		if (block.blocker.uuid !== user.uuid) {
			throw new ForbiddenException('not allowed', 'block');
		}

		await this.userBlockRepository.delete(block);
	}
}

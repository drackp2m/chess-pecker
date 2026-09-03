import type { ReadNotificationsRequest } from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { GenerateNowDateUseCase } from '../../../shared/use-case/generate-now-date.use-case';
import { User } from '../../user/user.entity';
import { UserNotificationRepository } from '../user-notification.repository';

@Injectable()
export class ReadNotificationsUseCase {
	constructor(private readonly userNotificationRepository: UserNotificationRepository) {}

	/**
	 * Reading again is not an error and does not move the date: the row is stamped once,
	 * so two tabs marking the same notice do not disagree about when it was seen.
	 */
	async execute(user: User, request: ReadNotificationsRequest): Promise<void> {
		await this.userNotificationRepository.markRead(
			user.uuid,
			request.uuids,
			new GenerateNowDateUseCase().execute(),
		);
	}
}

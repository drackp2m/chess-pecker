import type { UserNotification as UserNotificationResponse } from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { ListNotificationsRequestDto } from '../dto/request/list-notifications-request.dto';
import { UserNotificationRepository } from '../user-notification.repository';
import { presentNotification } from '../util/user-notification.util';

const DEFAULT_LIMIT = 50;

@Injectable()
export class ListNotificationsUseCase {
	constructor(private readonly userNotificationRepository: UserNotificationRepository) {}

	/**
	 * Newest first and capped: an account that never opened the inbox would otherwise drag
	 * its whole history down on every poll.
	 */
	async execute(
		user: User,
		query: ListNotificationsRequestDto,
	): Promise<UserNotificationResponse[]> {
		const notifications = await this.userNotificationRepository.getMany(
			{ user: user.uuid },
			{
				populate: ['actor', 'share'],
				orderBy: { createdAt: 'desc', uuid: 'desc' },
				limit: query.limit ?? DEFAULT_LIMIT,
			},
		);

		return notifications.map((notification) => presentNotification(notification));
	}
}

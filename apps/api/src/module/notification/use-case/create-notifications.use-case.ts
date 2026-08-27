import { Injectable } from '@nestjs/common';

import { PuzzleShare } from '../../puzzle-share/puzzle-share.entity';
import { User } from '../../user/user.entity';
import { UserNotificationType } from '../definition/user-notification-type.enum';
import { UserNotification } from '../user-notification.entity';
import { UserNotificationRepository } from '../user-notification.repository';

export interface NotificationDraft {
	readonly user: User;
	readonly type: UserNotificationType;
	readonly actor?: User;
	readonly share?: PuzzleShare;
}

/**
 * The one way a notice is written. It is exported by the module so whoever raises the event
 * owns the wording of it, and the inbox owns nothing but the reading.
 */
@Injectable()
export class CreateNotificationsUseCase {
	constructor(private readonly userNotificationRepository: UserNotificationRepository) {}

	async execute(drafts: readonly NotificationDraft[]): Promise<void> {
		await this.userNotificationRepository.insertMany(
			drafts.map((draft) => new UserNotification({ ...draft })),
		);
	}
}

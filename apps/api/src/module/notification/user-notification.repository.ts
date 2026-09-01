import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { UserNotification } from './user-notification.entity';

export class UserNotificationRepository extends CustomRepository<UserNotification> {
	/**
	 * One flush for the whole batch: a share to five friends writes five notices, and five
	 * round trips would leave four of them behind if the fifth failed.
	 */
	async insertMany(notifications: UserNotification[]): Promise<void> {
		if (0 === notifications.length) {
			return;
		}

		await this.entityManager.fork().persist(notifications).flush();
	}

	/**
	 * Marks the caller's own rows read; a uuid belonging to somebody else matches nothing.
	 * Only the unread ones are touched, so a second tab reading the same notice does not
	 * move the date the first one stamped.
	 */
	async markRead(userUuid: string, uuids: string[], readAt: Date): Promise<void> {
		if (0 === uuids.length) {
			return;
		}

		await this.entityManager
			.fork()
			.nativeUpdate(
				UserNotification,
				{ user: userUuid, uuid: { $in: uuids }, readAt: null },
				{ readAt },
			);
	}
}

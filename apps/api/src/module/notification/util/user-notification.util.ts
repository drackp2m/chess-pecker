import type { UserNotification as UserNotificationResponse } from '@chesspecker/api-definitions';

import { toIsoDate } from '../../../shared/util/to-iso-date';
import { UserNotification } from '../user-notification.entity';

/**
 * The challenge leaves as a uuid rather than as the whole thing: the list is a list of
 * notices, and whoever opens one asks for the challenge itself.
 */
export function presentNotification(notification: UserNotification): UserNotificationResponse {
	const actor = notification.actor;

	return {
		uuid: notification.uuid,
		type: notification.type,
		actor: undefined === actor ? null : { uuid: actor.uuid, username: actor.username },
		shareUuid: notification.share?.uuid ?? null,
		readAt: undefined === notification.readAt ? null : toIsoDate(notification.readAt),
		createdAt: toIsoDate(notification.createdAt),
	};
}

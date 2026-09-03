import { z } from 'zod';

import type { UserSummary } from './user';

export type UserNotificationType = 'puzzle-share-received' | 'puzzle-share-solved';

/**
 * Something that happened to the user while they were not looking. Rows are kept after
 * being read, so the screen that lists them can show a history and not only a badge.
 */
export interface UserNotification {
	readonly uuid: string;
	readonly type: UserNotificationType;
	/** Whoever caused it: the friend who shared the exercise, or the one who solved it. */
	readonly actor: UserSummary | null;
	/** The challenge it is about, so a screen can open it. */
	readonly shareUuid: string | null;
	readonly readAt: string | null;
	readonly createdAt: string;
}

export interface ListNotificationsRequest {
	limit?: number;
}

export interface ReadNotificationsRequest {
	uuids: string[];
}

export const listNotificationsRequestSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const readNotificationsRequestSchema = z.object({
	uuids: z.array(z.uuid()).min(1).max(100),
});

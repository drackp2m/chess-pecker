import { z } from 'zod';

import type { Avatar } from './avatar';

export type UserRole = 'admin' | 'registered' | 'guest';

export interface UserSummary {
	readonly uuid: string;
	readonly username: string;
}

export interface PublicUser extends UserSummary {
	readonly avatar: Avatar | null;
}

export interface UserAvatar {
	readonly uuid: string;
	readonly avatar: Avatar | null;
}

export interface SearchUserRequest {
	username: string;
	limit?: number;
}

export const searchUserRequestSchema = z.object({
	username: z.string().min(1),
	limit: z.coerce.number().int().min(1).max(25).optional(),
});

export const MAX_AVATAR_LOOKUP = 50;

export interface GetUserAvatarsRequest {
	uuids: readonly string[];
}

export const getUserAvatarsRequestSchema = z.object({
	uuids: z
		.union([z.string(), z.array(z.string())])
		.transform((value) => (Array.isArray(value) ? value : [value]))
		.pipe(z.array(z.string().min(1)).min(1).max(MAX_AVATAR_LOOKUP)),
});

export type GetUserAvatarsRequestParsed = z.output<typeof getUserAvatarsRequestSchema>;

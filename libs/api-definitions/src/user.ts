import { z } from 'zod';

import type { Avatar } from './avatar';

export type UserRole = 'admin' | 'registered' | 'guest';

export interface UserSummary {
	readonly uuid: string;
	readonly username: string;
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

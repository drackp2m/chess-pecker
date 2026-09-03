import { z } from 'zod';

import type { UserRole } from './user';

export const loginRequestSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
});

export type LoginRequest = z.input<typeof loginRequestSchema>;

export const registerRequestSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
	email: z.email().optional(),
});

export type RegisterRequest = z.input<typeof registerRequestSchema>;

export interface AuthUser {
	readonly uuid: string;
	readonly username: string;
	readonly role: UserRole;
	readonly email?: string;
}

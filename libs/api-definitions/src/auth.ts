import type { UserRole } from './user';

export interface LoginRequest {
	username: string;
	password: string;
}

export interface RegisterRequest {
	username: string;
	password: string;
	email?: string;
}

export interface AuthUser {
	readonly uuid: string;
	readonly username: string;
	readonly role: UserRole;
	readonly email?: string;
}

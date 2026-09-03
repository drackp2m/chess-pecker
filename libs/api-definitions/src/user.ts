export type UserRole = 'admin' | 'registered' | 'guest';

export interface UserSummary {
	readonly uuid: string;
	readonly username: string;
}

export interface SearchUserRequest {
	username: string;
	limit?: number;
}

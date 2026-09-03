import type { UserRole } from './user';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface FriendUser {
	readonly uuid: string;
	readonly username: string;
	readonly role: UserRole;
	readonly email?: string;
}

export interface Friendship {
	readonly uuid: string;
	readonly requester: FriendUser;
	readonly addressee: FriendUser;
	readonly status: FriendshipStatus;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface FriendRequests {
	readonly received: readonly Friendship[];
	readonly sent: readonly Friendship[];
}

export interface UserBlock {
	readonly uuid: string;
	readonly blocked: FriendUser;
	readonly createdAt: string;
}

export interface SendFriendRequest {
	username: string;
}

export interface BlockUserRequest {
	username: string;
}

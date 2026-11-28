import type {
	Avatar as AvatarResponse,
	PublicUser,
	UserAvatar,
	UserSummary,
} from '@chesspecker/api-definitions';

import { Avatar, User } from '../user.entity';

export function toAvatarResponse(avatar: Avatar): AvatarResponse {
	return { piece: avatar.piece, color: avatar.color, background: avatar.background };
}

export function presentUserSummary(user: User): UserSummary {
	return { uuid: user.uuid, username: user.username };
}

export function presentUserAvatar(user: User): UserAvatar {
	const avatar = user.avatar;

	return {
		uuid: user.uuid,
		avatar: null === avatar || undefined === avatar ? null : toAvatarResponse(avatar),
	};
}

export function presentPublicUser(user: User): PublicUser {
	return { ...presentUserSummary(user), avatar: presentUserAvatar(user).avatar };
}

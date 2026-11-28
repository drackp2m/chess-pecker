import type { Avatar as AvatarResponse, UserSummary } from '@chesspecker/api-definitions';

import { Avatar, User } from '../user.entity';

export function toAvatarResponse(avatar: Avatar): AvatarResponse {
	return { piece: avatar.piece, color: avatar.color, background: avatar.background };
}

export function presentUserSummary(user: User): UserSummary {
	const avatar = user.avatar;

	return {
		uuid: user.uuid,
		username: user.username,
		avatar: null === avatar || undefined === avatar ? null : toAvatarResponse(avatar),
	};
}

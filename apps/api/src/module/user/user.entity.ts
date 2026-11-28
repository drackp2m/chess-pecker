import { AVATAR_COLORS, AVATAR_PIECES } from '@chesspecker/api-definitions';
import type { AvatarColor, AvatarPiece } from '@chesspecker/api-definitions';
import { Embeddable, Embedded, Entity, Enum, Property } from '@mikro-orm/decorators/legacy';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';

import { UserRole } from './definition/user-role.enum';
import { UserRepository } from './user.repository';

@Embeddable()
export class Avatar {
	@Enum({ items: [...AVATAR_PIECES] })
	piece!: AvatarPiece;

	@Enum({ items: [...AVATAR_COLORS] })
	color!: AvatarColor;

	@Enum({ items: [...AVATAR_COLORS] })
	background!: AvatarColor;

	constructor(init: Pick<Avatar, 'piece' | 'color' | 'background'>) {
		this.piece = init.piece;
		this.color = init.color;
		this.background = init.background;
	}
}

@Entity({ repository: () => UserRepository })
export class User extends CustomBaseEntity<User> {
	@Property({ type: 'string', unique: true })
	username!: string;

	@Property({ type: 'string', hidden: true })
	password!: string;

	@Property({ type: 'string', unique: true, nullable: true })
	email?: string;

	@Enum({ items: () => UserRole, default: UserRole.Registered })
	role!: UserRole;

	@Embedded(() => Avatar, { nullable: true })
	avatar?: Avatar | null;
}

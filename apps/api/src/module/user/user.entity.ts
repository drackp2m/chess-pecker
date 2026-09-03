import { Entity, Enum, Property } from '@mikro-orm/decorators/legacy';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';

import { UserRole } from './definition/user-role.enum';
import { UserRepository } from './user.repository';

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
}

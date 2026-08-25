import type { SettingValue } from '@chesspecker/api-definitions';
import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/core';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { User } from '../user/user.entity';

import { UserSettingRepository } from './user-setting.repository';

/**
 * App preferences as key-value, so adding or reshaping a setting never touches the schema.
 * Defaults are not stored: a missing row means the default in code.
 */
@Entity({ repository: () => UserSettingRepository })
@Unique({ properties: ['user', 'key'] })
export class UserSetting extends CustomBaseEntity<UserSetting> {
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	user!: User;

	@Property()
	key!: string;

	@Property({ type: 'json' })
	value!: SettingValue;
}

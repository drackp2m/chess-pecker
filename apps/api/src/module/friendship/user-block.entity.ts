import { Check, Entity, ManyToOne, Unique } from '@mikro-orm/core';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { User } from '../user/user.entity';

import { UserBlockRepository } from './user-block.repository';

/**
 * Tabla aparte de `friendship` porque un bloqueo es asimétrico y tiene vida propia: debe
 * sobrevivir a que la amistad se borre, y es lo que impide volver a pedirla.
 */
@Entity({ repository: () => UserBlockRepository })
@Unique({ properties: ['blocker', 'blocked'] })
@Check({ expression: 'blocker_uuid <> blocked_uuid' })
export class UserBlock extends CustomBaseEntity<UserBlock> {
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	blocker!: User;

	@ManyToOne(() => User, { deleteRule: 'cascade' })
	blocked!: User;
}

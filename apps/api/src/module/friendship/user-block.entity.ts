import { Check, Entity, ManyToOne, Unique } from '@mikro-orm/decorators/es';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { User } from '../user/user.entity';

import { UserBlockRepository } from './user-block.repository';

/**
 * Kept apart from `friendship` because a block is asymmetric and has a life of its own: it
 * has to survive the friendship being deleted, and is what stops it being asked for again.
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

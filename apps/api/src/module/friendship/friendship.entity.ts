import { Check, Entity, Enum, Index, ManyToOne } from '@mikro-orm/decorators/legacy';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { User } from '../user/user.entity';

import { FriendshipStatus } from './definition/friendship-status.enum';
import { FriendshipRepository } from './friendship.repository';

/**
 * One row per request, not per relation: rejected ones stay as history. At most one live
 * request per pair is enforced by `friendship_active_pair_unique`, a hand-written index.
 */
@Entity({ repository: () => FriendshipRepository })
@Check({ expression: 'requester_uuid <> addressee_uuid' })
@Index({
	name: 'friendship_active_pair_unique',
	expression: `create unique index "friendship_active_pair_unique" on "friendship" (least("requester_uuid", "addressee_uuid"), greatest("requester_uuid", "addressee_uuid")) where "status" in ('pending', 'accepted')`,
})
export class Friendship extends CustomBaseEntity<Friendship> {
	@Index()
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	requester!: User;

	@Index()
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	addressee!: User;

	@Enum({ items: () => FriendshipStatus, default: FriendshipStatus.Pending })
	status!: FriendshipStatus;
}

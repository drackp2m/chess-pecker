import { Entity, Enum, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { PuzzleShare } from '../puzzle-share/puzzle-share.entity';
import { User } from '../user/user.entity';

import { UserNotificationType } from './definition/user-notification-type.enum';
import { UserNotificationRepository } from './user-notification.repository';

/**
 * Something that happened to a user while they were not looking. The subject is a typed
 * column and not a loose uuid, so a deleted challenge takes its notices with it: a kind
 * about something else adds its own nullable reference beside this one.
 *
 * Read rows are kept. Nothing is ever deleted here, which is what lets a screen list the
 * history rather than only what is still pending.
 */
@Entity({ repository: () => UserNotificationRepository })
@Index({ properties: ['user', 'createdAt'] })
export class UserNotification extends CustomBaseEntity<UserNotification> {
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	user!: User;

	@Enum({ items: () => UserNotificationType })
	type!: UserNotificationType;

	/** Whoever caused it. Nothing points back at the user themselves. */
	@ManyToOne(() => User, { deleteRule: 'cascade', nullable: true })
	actor?: User;

	@ManyToOne(() => PuzzleShare, { deleteRule: 'cascade', nullable: true })
	share?: PuzzleShare;

	@Property({ type: 'datetime', nullable: true })
	readAt?: Date;
}

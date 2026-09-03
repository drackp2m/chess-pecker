import { Check, Entity, Enum, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';

import { SyncableBaseEntity } from '../../shared/util/syncable-base.entity';
import { User } from '../user/user.entity';

import { TrainingFinishedReason } from './definition/training-finished-reason.enum';
import { TrainingStatus } from './definition/training-status.enum';
import { TrainingRepository } from './training.repository';

/**
 * The whole programme, lasting `createdAt` → `finishedAt`. Nothing derivable is stored, but
 * `finishedAt` is explicit: a training can end with no attempt behind it.
 */
@Entity({ repository: () => TrainingRepository })
@Index({ properties: ['user', 'status'] })
@Check({
	name: 'training_cancelled_matches_reason_check',
	expression: `finished_reason is null or ((status = 'cancelled') = (finished_reason = 'cancelled'))`,
})
export class Training extends SyncableBaseEntity<Training> {
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	user!: User;

	@Enum({ items: () => TrainingStatus, default: TrainingStatus.Calibrating })
	status!: TrainingStatus;

	@Enum({ items: () => TrainingFinishedReason, nullable: true })
	finishedReason?: TrainingFinishedReason;

	@Property({ type: 'datetime', nullable: true })
	finishedAt?: Date;
}

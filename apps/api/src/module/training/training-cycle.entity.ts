import { Entity, Enum, ManyToOne, Property, Unique } from '@mikro-orm/decorators/es';

import { SyncableBaseEntity } from '../../shared/util/syncable-base.entity';

import { TrainingCycleStatus } from './definition/training-cycle-status.enum';
import { TrainingCycleRepository } from './training-cycle.repository';
import { Training } from './training.entity';

/**
 * The whole set once through. No target time and no start or end dates: cycles are created
 * one at a time, so `createdAt` is the start and the close is their attempts' `max`.
 */
@Entity({ repository: () => TrainingCycleRepository })
@Unique({ properties: ['training', 'index'] })
export class TrainingCycle extends SyncableBaseEntity<TrainingCycle> {
	@ManyToOne(() => Training, { deleteRule: 'cascade' })
	training!: Training;

	/** Cycle number, starting at 1. */
	@Property()
	index!: number;

	@Enum({ items: () => TrainingCycleStatus, default: TrainingCycleStatus.Running })
	status!: TrainingCycleStatus;

	@Property()
	itemCount!: number;
}

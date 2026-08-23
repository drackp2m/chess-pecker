import { Check, Entity, Index, ManyToOne, Property } from '@mikro-orm/core';

import { SyncableBaseEntity } from '../../shared/util/syncable-base.entity';

import { TrainingGoalRepository } from './training-goal.repository';
import { Training } from './training.entity';

/**
 * The pace the user commits to for cycle 1, append-only: overwriting would erase the
 * difference between keeping the plan and moving the goal until it fits.
 */
@Entity({ repository: () => TrainingGoalRepository })
@Index({ properties: ['training', 'createdAt'] })
@Check({
	name: 'training_goal_has_target_check',
	expression: 'puzzles_per_day is not null or end_date is not null',
})
export class TrainingGoal extends SyncableBaseEntity<TrainingGoal> {
	@ManyToOne(() => Training, { deleteRule: 'cascade' })
	training!: Training;

	@Property({ nullable: true })
	puzzlesPerDay?: number;

	@Property({ type: 'date', nullable: true })
	endDate?: Date;
}

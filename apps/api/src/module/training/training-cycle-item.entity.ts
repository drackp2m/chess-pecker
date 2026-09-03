import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';

import { SyncableBaseEntity } from '../../shared/util/syncable-base.entity';

import { TrainingCycleItemRepository } from './training-cycle-item.repository';
import { TrainingCycle } from './training-cycle.entity';
import { TrainingPuzzle } from './training-puzzle.entity';

/**
 * The exercise order for one cycle, materialized in full on creation: computing it on the
 * fly would change the sequence under the user whenever the shuffle does.
 */
@Entity({ repository: () => TrainingCycleItemRepository })
@Unique({ properties: ['cycle', 'position'] })
@Unique({ properties: ['cycle', 'trainingPuzzle'] })
export class TrainingCycleItem extends SyncableBaseEntity<TrainingCycleItem> {
	@ManyToOne(() => TrainingCycle, { deleteRule: 'cascade' })
	cycle!: TrainingCycle;

	@ManyToOne(() => TrainingPuzzle, { deleteRule: 'cascade' })
	trainingPuzzle!: TrainingPuzzle;

	/** 0..X-1, the order they are presented in. */
	@Property({ type: 'number' })
	position!: number;
}

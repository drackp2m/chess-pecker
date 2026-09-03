import { Entity, Index, ManyToOne, Unique } from '@mikro-orm/decorators/es';

import { SyncableBaseEntity } from '../../shared/util/syncable-base.entity';
import { Puzzle } from '../puzzle/puzzle.entity';

import { TrainingPuzzleRepository } from './training-puzzle.repository';
import { Training } from './training.entity';

/**
 * The selected exercises, unordered: what is in the training. Keeping the order out, in
 * `training_cycle_item`, is what guarantees every cycle walks the same set.
 */
@Entity({ repository: () => TrainingPuzzleRepository })
@Unique({ properties: ['training', 'puzzle'] })
@Index({ properties: ['training'] })
export class TrainingPuzzle extends SyncableBaseEntity<TrainingPuzzle> {
	@ManyToOne(() => Training, { deleteRule: 'cascade' })
	training!: Training;

	@ManyToOne(() => Puzzle)
	puzzle!: Puzzle;
}

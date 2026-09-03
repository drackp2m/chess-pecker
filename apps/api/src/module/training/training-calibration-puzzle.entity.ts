import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';

import { SyncableBaseEntity } from '../../shared/util/syncable-base.entity';
import { Puzzle } from '../puzzle/puzzle.entity';

import { TrainingCalibrationPuzzleRepository } from './training-calibration-puzzle.repository';
import { TrainingCalibrationRound } from './training-calibration-round.entity';

@Entity({ repository: () => TrainingCalibrationPuzzleRepository })
@Unique({ properties: ['calibrationRound', 'position'] })
@Unique({ properties: ['calibrationRound', 'puzzle'] })
export class TrainingCalibrationPuzzle extends SyncableBaseEntity<TrainingCalibrationPuzzle> {
	@ManyToOne(() => TrainingCalibrationRound, { deleteRule: 'cascade' })
	calibrationRound!: TrainingCalibrationRound;

	@ManyToOne(() => Puzzle)
	puzzle!: Puzzle;

	@Property({ type: 'number' })
	position!: number;
}

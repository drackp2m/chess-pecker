import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/core';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { Puzzle } from '../puzzle/puzzle.entity';

import { TrainingCalibrationPuzzleRepository } from './training-calibration-puzzle.repository';
import { TrainingCalibrationRound } from './training-calibration-round.entity';

@Entity({ repository: () => TrainingCalibrationPuzzleRepository })
@Unique({ properties: ['calibrationRound', 'position'] })
@Unique({ properties: ['calibrationRound', 'puzzle'] })
export class TrainingCalibrationPuzzle extends CustomBaseEntity<TrainingCalibrationPuzzle> {
	@ManyToOne(() => TrainingCalibrationRound, { deleteRule: 'cascade' })
	calibrationRound!: TrainingCalibrationRound;

	@ManyToOne(() => Puzzle)
	puzzle!: Puzzle;

	@Property()
	position!: number;
}

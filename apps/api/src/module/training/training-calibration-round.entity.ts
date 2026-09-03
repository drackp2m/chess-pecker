import { Check, Entity, Enum, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';

import { SyncableBaseEntity } from '../../shared/util/syncable-base.entity';

import { CalibrationRoundKind } from './definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from './definition/calibration-round-outcome.enum';
import { TrainingCalibrationRoundRepository } from './training-calibration-round.repository';
import { Training } from './training.entity';

/**
 * Exploration and refine in one table: an ELO band, some attempts and a decision, differing only in
 * how many attempts hang off them. Everything derived lives in `puzzle_attempt`.
 */
@Entity({ repository: () => TrainingCalibrationRoundRepository })
@Unique({ properties: ['training', 'index'] })
@Check({ name: 'calibration_round_rating_bucket_check', expression: 'rating % 100 = 0' })
export class TrainingCalibrationRound extends SyncableBaseEntity<TrainingCalibrationRound> {
	@ManyToOne(() => Training, { deleteRule: 'cascade' })
	training!: Training;

	/** Global order of the rounds within the training, from 1. */
	@Property({ type: 'number' })
	index!: number;

	/**
	 * What it was created as, never derived from the attempt count: a scan that ends up with
	 * two attempts must not read as a refine.
	 */
	@Enum({ items: () => CalibrationRoundKind })
	kind!: CalibrationRoundKind;

	/** The bottom of the hundred (600 ⇒ 600-699); the top is always `rating + 99`. */
	@Property({ type: 'number' })
	rating!: number;

	/** Anything but `pending` says the round is closed, so there is no `finishedAt`. */
	@Enum({ items: () => CalibrationRoundOutcome, default: CalibrationRoundOutcome.Pending })
	outcome!: CalibrationRoundOutcome;
}

import { Check, Entity, Enum, ManyToOne, Property, Unique } from '@mikro-orm/core';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';

import { CalibrationRoundKind } from './definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from './definition/calibration-round-outcome.enum';
import { TrainingCalibrationRoundRepository } from './training-calibration-round.repository';
import { Training } from './training.entity';

/**
 * Sondeo y afinado en la misma tabla: estructuralmente son lo mismo —una franja de ELO,
 * unos intentos y una decisión—, sólo cambia cuántos intentos cuelgan.
 *
 * `rating` es el mínimo de la centena (600 ⇒ 600-699). El máximo es siempre `rating + 99`,
 * así que guardarlo sería guardar una constante.
 *
 * No hay `finishedAt`: `outcome <> 'pending'` ya dice que está cerrada. Ni tasa de acierto
 * ni tiempo medio: salen de `puzzle_attempt`.
 */
@Entity({ repository: () => TrainingCalibrationRoundRepository })
@Unique({ properties: ['training', 'index'] })
@Check({ name: 'calibration_round_rating_bucket_check', expression: 'rating % 100 = 0' })
export class TrainingCalibrationRound extends CustomBaseEntity<TrainingCalibrationRound> {
	@ManyToOne(() => Training, { deleteRule: 'cascade' })
	training!: Training;

	/** Orden global de las rondas dentro del entrenamiento, empezando en 1. */
	@Property()
	index!: number;

	/**
	 * La intención con la que se creó, no algo derivado del número de intentos: un sondeo
	 * que acabe teniendo dos intentos no debe convertirse en un afinado para las consultas.
	 */
	@Enum({ items: () => CalibrationRoundKind })
	kind!: CalibrationRoundKind;

	@Property()
	rating!: number;

	@Enum({ items: () => CalibrationRoundOutcome, default: CalibrationRoundOutcome.Pending })
	outcome!: CalibrationRoundOutcome;
}

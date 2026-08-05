import { Check, Entity, Enum, Index, ManyToOne, Property } from '@mikro-orm/core';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { Puzzle } from '../puzzle/puzzle.entity';

import { PuzzleAttemptClosure } from './definition/puzzle-attempt-closure.enum';
import { PuzzleAttemptKind } from './definition/puzzle-attempt-kind.enum';
import { PuzzleAttemptRepository } from './puzzle-attempt.repository';
import { TrainingCalibrationRound } from './training-calibration-round.entity';
import { TrainingCycleItem } from './training-cycle-item.entity';
import { Training } from './training.entity';

/**
 * Un ejercicio terminado, tanto en calibración como en ciclo. `kind` es lo que
 * diferencia las partidas de calibración de las del entrenamiento.
 *
 * **Append-only**: el front no manda nada hasta que el ejercicio termina —cuando la
 * solución sale, jugada o pedida—, así que el servidor no ve intentos a medias y la fila se
 * escribe una vez. Por eso `updatedAt` es el momento en que se cerró el ejercicio —con eso
 * agrupa por día la pantalla de progreso— y no hay `finishedAt`. `createdAt` es cuándo se
 * abrió por primera vez, que puede ser días antes; ambos viajan desde el cliente y el API no
 * los re-sella.
 *
 * `durationMs` es tiempo acumulado con el ejercicio a la vista hasta dar con la solución, no
 * la diferencia entre dos fechas: el usuario puede abrirlo, dejarlo y volver al día
 * siguiente.
 *
 * `solved` es booleano y no enum porque un ejercicio no se puede saltar: acaba en acierto o
 * en fallo. Y se juzga a la primera, sin reintento, así que `false` es definitivo aunque el
 * usuario siga buscando después. Esa búsqueda es lo que cuentan los demás campos: `closure`
 * dice cómo acabó —encontrada o rendido—, y `hintUsed` y `mistakeCount`, con qué ayuda.
 */
@Entity({ repository: () => PuzzleAttemptRepository })
@Index({ properties: ['training', 'kind'] })
@Index({ properties: ['puzzle', 'training'] })
@Check({
	name: 'puzzle_attempt_kind_parent_check',
	expression: `(kind = 'calibration' and calibration_round_uuid is not null and cycle_item_uuid is null) or (kind = 'cycle' and cycle_item_uuid is not null and calibration_round_uuid is null)`,
})
export class PuzzleAttempt extends CustomBaseEntity<PuzzleAttempt> {
	/** Desnormalizado a propósito: evita un join en toda consulta de progreso. */
	@ManyToOne(() => Training, { deleteRule: 'cascade' })
	training!: Training;

	@Enum({ items: () => PuzzleAttemptKind })
	kind!: PuzzleAttemptKind;

	@ManyToOne(() => TrainingCalibrationRound, { deleteRule: 'cascade', nullable: true })
	calibrationRound?: TrainingCalibrationRound;

	@Index()
	@ManyToOne(() => TrainingCycleItem, { deleteRule: 'cascade', nullable: true })
	cycleItem?: TrainingCycleItem;

	@ManyToOne(() => Puzzle)
	puzzle!: Puzzle;

	@Property()
	durationMs!: number;

	@Property()
	solved!: boolean;

	@Enum({ items: () => PuzzleAttemptClosure })
	closure!: PuzzleAttemptClosure;

	@Property({ default: false })
	hintUsed!: boolean;

	@Property({ default: 0 })
	mistakeCount!: number;
}

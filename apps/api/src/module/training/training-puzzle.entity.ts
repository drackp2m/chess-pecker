import { Entity, Index, ManyToOne, Unique } from '@mikro-orm/core';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';
import { Puzzle } from '../puzzle/puzzle.entity';

import { TrainingPuzzleRepository } from './training-puzzle.repository';
import { Training } from './training.entity';

/**
 * Los X ejercicios seleccionados, sin orden: define **qué** entra en el entrenamiento. El
 * orden es propio de cada ciclo y vive en `training_cycle_item`.
 *
 * Separar set y orden garantiza por construcción que todos los ciclos recorren el mismo
 * set: un ciclo no puede meter un ejercicio que no esté aquí. X es `count(*)`, y la franja
 * de ELO de cada ejercicio es `puzzle.rating / 100`, calculada al vuelo al barajar.
 */
@Entity({ repository: () => TrainingPuzzleRepository })
@Unique({ properties: ['training', 'puzzle'] })
@Index({ properties: ['training'] })
export class TrainingPuzzle extends CustomBaseEntity<TrainingPuzzle> {
	@ManyToOne(() => Training, { deleteRule: 'cascade' })
	training!: Training;

	@ManyToOne(() => Puzzle)
	puzzle!: Puzzle;
}

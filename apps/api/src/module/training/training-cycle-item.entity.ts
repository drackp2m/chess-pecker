import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/core';

import { SyncableBaseEntity } from '../../shared/util/syncable-base.entity';

import { TrainingCycleItemRepository } from './training-cycle-item.repository';
import { TrainingCycle } from './training-cycle.entity';
import { TrainingPuzzle } from './training-puzzle.entity';

/**
 * El orden de los ejercicios en ese ciclo, materializado entero al crearlo con una
 * inserción masiva de X filas. No se calcula al vuelo para que el usuario vea siempre la
 * misma secuencia aunque mañana cambie el algoritmo de barajado, y para que el histórico de
 * ciclos anteriores quede intacto.
 *
 * El único por `(cycle, trainingPuzzle)` es el que impide que un barajado con un bug
 * duplique un ejercicio dentro de la pasada.
 */
@Entity({ repository: () => TrainingCycleItemRepository })
@Unique({ properties: ['cycle', 'position'] })
@Unique({ properties: ['cycle', 'trainingPuzzle'] })
export class TrainingCycleItem extends SyncableBaseEntity<TrainingCycleItem> {
	@ManyToOne(() => TrainingCycle, { deleteRule: 'cascade' })
	cycle!: TrainingCycle;

	@ManyToOne(() => TrainingPuzzle, { deleteRule: 'cascade' })
	trainingPuzzle!: TrainingPuzzle;

	/** 0..X-1, orden de presentación. */
	@Property()
	position!: number;
}

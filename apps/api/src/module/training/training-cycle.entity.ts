import { Entity, Enum, ManyToOne, Property, Unique } from '@mikro-orm/core';

import { CustomBaseEntity } from '../../shared/util/custom-base.entity';

import { TrainingCycleStatus } from './definition/training-cycle-status.enum';
import { TrainingCycleRepository } from './training-cycle.repository';
import { Training } from './training.entity';

/**
 * Una pasada completa sobre el set.
 *
 * Ningún tiempo objetivo vive aquí: el del ciclo 1 lo fija el usuario en `training_goal` y
 * el del resto lo calcula el caso de uso sobre el tiempo real del ciclo 1.
 *
 * Sin `startedAt` ni `finishedAt`: los ciclos se crean de uno en uno al terminar el
 * anterior, así que `createdAt` es cuando arranca, y el cierre es el `max(updatedAt)` de sus
 * intentos, que sale en la misma consulta que ya suma sus duraciones.
 */
@Entity({ repository: () => TrainingCycleRepository })
@Unique({ properties: ['training', 'index'] })
export class TrainingCycle extends CustomBaseEntity<TrainingCycle> {
	@ManyToOne(() => Training, { deleteRule: 'cascade' })
	training!: Training;

	/** Número de pasada, empezando en 1. */
	@Property()
	index!: number;

	@Enum({ items: () => TrainingCycleStatus, default: TrainingCycleStatus.Running })
	status!: TrainingCycleStatus;
}

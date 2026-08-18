import { Check, Entity, Index, ManyToOne, Property } from '@mikro-orm/core';

import { SyncableBaseEntity } from '../../shared/util/syncable-base.entity';

import { TrainingGoalRepository } from './training-goal.repository';
import { Training } from './training.entity';

/**
 * El ritmo que el usuario se compromete a llevar en el ciclo 1. **Append-only**: puede
 * cambiarlo sobre la marcha —la app le anima a apretar o a rebajar a algo realista— y cada
 * cambio es una fila nueva. El vigente es el último; el original, el primero. Sobreescribir
 * borraría la diferencia entre cumplir el plan y mover la meta hasta que encaje.
 *
 * Cuelga del entrenamiento y no del ciclo porque el objetivo del resto de ciclos no lo fija
 * el usuario: se calcula sobre el tiempo real del ciclo 1.
 *
 * Guarda ritmo, no duración: los días que va a costar salen de cruzar el ritmo con la media
 * de la calibración, y eso es cálculo.
 */
@Entity({ repository: () => TrainingGoalRepository })
@Index({ properties: ['training', 'createdAt'] })
@Check({
	name: 'training_goal_has_target_check',
	expression: 'puzzles_per_day is not null or end_date is not null',
})
export class TrainingGoal extends SyncableBaseEntity<TrainingGoal> {
	@ManyToOne(() => Training, { deleteRule: 'cascade' })
	training!: Training;

	@Property({ nullable: true })
	puzzlesPerDay?: number;

	@Property({ type: 'date', nullable: true })
	endDate?: Date;
}

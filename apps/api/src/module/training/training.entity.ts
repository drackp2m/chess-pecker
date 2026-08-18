import { Check, Entity, Enum, Index, ManyToOne, Property } from '@mikro-orm/core';

import { SyncableBaseEntity } from '../../shared/util/syncable-base.entity';
import { User } from '../user/user.entity';

import { TrainingFinishedReason } from './definition/training-finished-reason.enum';
import { TrainingStatus } from './definition/training-status.enum';
import { TrainingRepository } from './training.repository';

/**
 * El programa completo. Su duración es `createdAt` → `finishedAt`.
 *
 * No guarda nada derivable: ni el ELO calibrado (es el `rating` de la ronda aceptada), ni
 * el tiempo medio de la calibración, ni el tiempo de referencia del ciclo 1 (la suma de
 * los `durationMs` de sus intentos). El mínimo y el tope de ciclos son política de la app,
 * no columnas, mientras el usuario no los elija por entrenamiento.
 *
 * `finishedAt` sí es explícito, y es la única tabla del entrenamiento que lo tiene: un
 * entrenamiento puede acabar sin intento detrás (cancelación), y su `status` cambia varias
 * veces, así que `updatedAt` no significa "cuándo acabó" como sí ocurre en `puzzle_attempt`.
 */
@Entity({ repository: () => TrainingRepository })
@Index({ properties: ['user', 'status'] })
@Check({
	name: 'training_abandoned_matches_reason_check',
	expression: `finished_reason is null or ((status = 'abandoned') = (finished_reason = 'cancelled'))`,
})
export class Training extends SyncableBaseEntity<Training> {
	@ManyToOne(() => User, { deleteRule: 'cascade' })
	user!: User;

	@Enum({ items: () => TrainingStatus, default: TrainingStatus.Calibrating })
	status!: TrainingStatus;

	@Enum({ items: () => TrainingFinishedReason, nullable: true })
	finishedReason?: TrainingFinishedReason;

	@Property({ nullable: true })
	finishedAt?: Date;
}

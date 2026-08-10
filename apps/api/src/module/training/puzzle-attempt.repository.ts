import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { PuzzleAttemptKind } from './definition/puzzle-attempt-kind.enum';
import { TrainingActivityDay } from './definition/training-activity.interface';
import { PuzzleAttempt } from './puzzle-attempt.entity';

export class PuzzleAttemptRepository extends CustomRepository<PuzzleAttempt> {
	async getManyByCalibrationRound(roundUuid: string): Promise<PuzzleAttempt[]> {
		return this.getMany({ calibrationRound: roundUuid });
	}

	/**
	 * Los intentos de un ciclo. Es la fuente de todo lo que se muestra de él: su tiempo
	 * total, su tasa de acierto y su fecha de cierre son agregados sobre estas filas, que ya
	 * no cambian.
	 */
	async getManyByCycle(cycleUuid: string): Promise<PuzzleAttempt[]> {
		return this.getMany(
			{ kind: PuzzleAttemptKind.Cycle, cycleItem: { cycle: cycleUuid } },
			{ populate: ['cycleItem'] },
		);
	}

	async getManyByTraining(trainingUuid: string): Promise<PuzzleAttempt[]> {
		return this.getMany({ training: trainingUuid });
	}

	/**
	 * Un intento sólo pertenece a un entrenamiento, así que el usuario sale del join.
	 *
	 * ToDo => `failed` mira `closure <> 'revealed'` en vez de `= 'found'` para que los tres
	 * repartos sumen siempre el total aunque llegue un `solved = false` con la solución
	 * enseñada más tarde. Probablemente `settleClosure` haga eso imposible —fija el cierre al
	 * primero que llega—, así que revisar si se puede dejar el `= 'found'`, que dice mejor lo
	 * que cuenta.
	 */
	async countByDaySince(userUuid: string, since: Date): Promise<TrainingActivityDay[]> {
		return (await this.entityManager
			.fork()
			.getConnection()
			.execute<TrainingActivityDay[]>(
				`select to_char(pa.updated_at, 'YYYY-MM-DD') as date,
				        count(*)::int as count,
				        count(*) filter (where pa.solved)::int as solved,
				        count(*) filter (where not pa.solved and pa.closure <> 'revealed')::int as failed,
				        count(*) filter (where not pa.solved and pa.closure = 'revealed')::int as resigned,
				        coalesce(sum(pa.mistake_count), 0)::int as mistakes,
				        count(*) filter (where pa.hint_used)::int as hints,
				        coalesce(sum(pa.duration_ms), 0)::int as "durationMs"
				 from puzzle_attempt pa
				 join training t on t.uuid = pa.training_uuid
				 where t.user_uuid = ? and pa.updated_at >= ?
				 group by to_char(pa.updated_at, 'YYYY-MM-DD')
				 order by date`,
				[userUuid, since],
			)) as TrainingActivityDay[];
	}
}

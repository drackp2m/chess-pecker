import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { PuzzleAttemptKind } from './definition/puzzle-attempt-kind.enum';
import { TrainingActivityDay } from './definition/training-activity.interface';
import { PuzzleAttempt } from './puzzle-attempt.entity';

const ACTIVITY_BY_DAY = `select to_char(pa.updated_at, 'YYYY-MM-DD') as date,
        count(*)::int as count,
        count(*) filter (where pa.solved)::int as solved,
        count(*) filter (where not pa.solved and pa.closure <> 'revealed')::int as failed,
        count(*) filter (where not pa.solved and pa.closure = 'revealed')::int as resigned,
        count(*) filter (where pa.closure = 'found' and not pa.hint_used and pa.mistake_count = 0)::int as "foundClean",
        count(*) filter (where pa.closure = 'found' and pa.hint_used and pa.mistake_count = 0)::int as "foundHinted",
        count(*) filter (where pa.closure = 'found' and not pa.hint_used and pa.mistake_count > 0)::int as "foundMissed",
        count(*) filter (where pa.closure = 'found' and pa.hint_used and pa.mistake_count > 0)::int as "foundMissedHinted",
        count(*) filter (where pa.closure = 'revealed' and not pa.hint_used)::int as revealed,
        count(*) filter (where pa.closure = 'revealed' and pa.hint_used)::int as "revealedHinted",
        coalesce(sum(pa.mistake_count), 0)::int as mistakes,
        count(*) filter (where pa.hint_used)::int as hints,
        coalesce(sum(pa.duration_ms), 0)::int as "durationMs"
 from puzzle_attempt pa
 join training t on t.uuid = pa.training_uuid
 where t.user_uuid = ? and pa.updated_at >= ?
 group by to_char(pa.updated_at, 'YYYY-MM-DD')`;

/** Sólo los días con alguna fila recibida después del corte; el resto no ha cambiado. */
const RECEIVED_AFTER = 'having max(pa.received_at) > ?';

interface CursorRow {
	cursor: Date | string | null;
}

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
	async countByDaySince(
		userUuid: string,
		since: Date,
		receivedAfter?: Date,
	): Promise<TrainingActivityDay[]> {
		const having = undefined === receivedAfter ? '' : RECEIVED_AFTER;
		const params: unknown[] = [userUuid, since];

		if (undefined !== receivedAfter) {
			params.push(receivedAfter);
		}

		return (await this.entityManager
			.fork()
			.getConnection()
			.execute<TrainingActivityDay[]>(
				`${ACTIVITY_BY_DAY} ${having} order by date`,
				params,
			)) as TrainingActivityDay[];
	}

	/**
	 * Hasta dónde ha visto llegar el servidor. Sirve de corte para la siguiente pregunta:
	 * lo que entre después traerá una fecha mayor, venga del dispositivo que venga.
	 */
	async lastReceivedAt(userUuid: string): Promise<Date | null> {
		const rows = (await this.entityManager
			.fork()
			.getConnection()
			.execute<CursorRow[]>(
				`select max(pa.received_at) as cursor
				 from puzzle_attempt pa
				 join training t on t.uuid = pa.training_uuid
				 where t.user_uuid = ?`,
				[userUuid],
			)) as CursorRow[];

		const cursor = rows[0]?.cursor ?? null;

		return null === cursor ? null : new Date(cursor);
	}
}

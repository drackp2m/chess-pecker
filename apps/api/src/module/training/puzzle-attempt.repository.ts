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

	/** Un intento sólo pertenece a un entrenamiento, así que el usuario sale del join. */
	async countByDaySince(userUuid: string, since: Date): Promise<TrainingActivityDay[]> {
		return (await this.entityManager
			.fork()
			.getConnection()
			.execute<TrainingActivityDay[]>(
				`select to_char(pa.updated_at, 'YYYY-MM-DD') as date, count(*)::int as count
				 from puzzle_attempt pa
				 join training t on t.uuid = pa.training_uuid
				 where t.user_uuid = ? and pa.updated_at >= ?
				 group by to_char(pa.updated_at, 'YYYY-MM-DD')
				 order by date`,
				[userUuid, since],
			)) as TrainingActivityDay[];
	}
}

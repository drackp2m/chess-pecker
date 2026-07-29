import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { PuzzleAttemptKind } from './definition/puzzle-attempt-kind.enum';
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
}

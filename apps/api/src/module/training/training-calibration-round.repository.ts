import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { CalibrationRoundOutcome } from './definition/calibration-round-outcome.enum';
import { TrainingCalibrationRound } from './training-calibration-round.entity';

export class TrainingCalibrationRoundRepository extends CustomRepository<TrainingCalibrationRound> {
	async getManyByTraining(trainingUuid: string): Promise<TrainingCalibrationRound[]> {
		return this.getMany({ training: trainingUuid }, { orderBy: { index: 'asc' } });
	}

	async updateOutcome(uuid: string, outcome: CalibrationRoundOutcome): Promise<void> {
		await this.entityManager.fork().nativeUpdate(TrainingCalibrationRound, { uuid }, { outcome });
	}

	async getAccepted(trainingUuid: string): Promise<TrainingCalibrationRound | undefined> {
		const rounds = await this.getMany({
			training: trainingUuid,
			outcome: CalibrationRoundOutcome.Accept,
		});

		return 0 < rounds.length ? rounds[0] : undefined;
	}
}

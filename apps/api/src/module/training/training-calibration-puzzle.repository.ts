import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { TrainingCalibrationPuzzle } from './training-calibration-puzzle.entity';

export class TrainingCalibrationPuzzleRepository extends CustomRepository<TrainingCalibrationPuzzle> {
	async insertMany(
		calibrationPuzzles: TrainingCalibrationPuzzle[],
	): Promise<TrainingCalibrationPuzzle[]> {
		await this.entityManager.fork().persist(calibrationPuzzles).flush();

		return calibrationPuzzles;
	}

	async countByRound(roundUuid: string): Promise<number> {
		return this.entityManager
			.fork()
			.count(TrainingCalibrationPuzzle, { calibrationRound: roundUuid });
	}

	async getManyByTraining(
		trainingUuid: string,
		receivedAfter?: Date,
	): Promise<TrainingCalibrationPuzzle[]> {
		return this.getMany(
			{
				calibrationRound: { training: trainingUuid },
				...(undefined === receivedAfter ? {} : { receivedAt: { $gt: receivedAfter } }),
			},
			{ orderBy: { position: 'asc' }, populate: ['puzzle'] },
		);
	}

	async getManyByRound(roundUuid: string): Promise<TrainingCalibrationPuzzle[]> {
		return this.getMany(
			{ calibrationRound: roundUuid },
			{ orderBy: { position: 'asc' }, populate: ['puzzle'] },
		);
	}
}

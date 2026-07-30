import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { TrainingCalibrationPuzzle } from './training-calibration-puzzle.entity';

export class TrainingCalibrationPuzzleRepository extends CustomRepository<TrainingCalibrationPuzzle> {
	async insertMany(
		calibrationPuzzles: TrainingCalibrationPuzzle[],
	): Promise<TrainingCalibrationPuzzle[]> {
		await this.entityManager.fork().persist(calibrationPuzzles).flush();

		return calibrationPuzzles;
	}

	async getManyByRound(roundUuid: string): Promise<TrainingCalibrationPuzzle[]> {
		return this.getMany(
			{ calibrationRound: roundUuid },
			{ orderBy: { position: 'asc' }, populate: ['puzzle'] },
		);
	}
}

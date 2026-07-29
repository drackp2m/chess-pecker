import { Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { PuzzleRepository } from '../../puzzle/puzzle.repository';
import { TrainingPolicy } from '../definition/training-policy';
import { TrainingStatus } from '../definition/training-status.enum';
import { SelectTrainingSetRequestDto } from '../dto/request/select-training-set-request.dto';
import { TrainingCalibrationRoundRepository } from '../training-calibration-round.repository';
import { TrainingPuzzle } from '../training-puzzle.entity';
import { TrainingPuzzleRepository } from '../training-puzzle.repository';
import { Training } from '../training.entity';
import { clampRatingBucket, ratingBucketCeiling } from '../util/rating-bucket.util';

@Injectable()
export class SelectTrainingSetUseCase {
	constructor(
		private readonly trainingPuzzleRepository: TrainingPuzzleRepository,
		private readonly calibrationRoundRepository: TrainingCalibrationRoundRepository,
		private readonly puzzleRepository: PuzzleRepository,
	) {}

	/**
	 * Los X ejercicios del entrenamiento, sacados de la franja calibrada ±100 en lugar de un
	 * ELO fijo, para que haya progresión de fácil a difícil dentro del set.
	 *
	 * Con qué otros criterios se elijan más adelante (temas preferidos, lo que sea) es cosa
	 * de este caso de uso: en la tabla sólo consta el resultado.
	 */
	async execute(training: Training, selectRequest: SelectTrainingSetRequestDto): Promise<number> {
		if (TrainingStatus.Planning !== training.status) {
			throw new PreconditionFailedException('calibration not finished', 'training');
		}

		if (0 < (await this.trainingPuzzleRepository.countByTraining(training.uuid))) {
			throw new PreconditionFailedException('already selected', 'set');
		}

		const accepted = await this.calibrationRoundRepository.getAccepted(training.uuid);

		if (undefined === accepted) {
			throw new PreconditionFailedException('no calibrated rating', 'calibration');
		}

		const size = selectRequest.size ?? TrainingPolicy.defaultSetSize;
		const spread = TrainingPolicy.setRatingSpread;

		const puzzles = await this.puzzleRepository.getManyRandomByRating(
			clampRatingBucket(accepted.rating - spread),
			ratingBucketCeiling(clampRatingBucket(accepted.rating + spread)),
			size,
		);

		if (0 === puzzles.length) {
			throw new PreconditionFailedException('not enough puzzles', 'rating');
		}

		const trainingPuzzles = puzzles.map((puzzle) => new TrainingPuzzle({ training, puzzle }));

		await this.trainingPuzzleRepository.insertMany(trainingPuzzles);

		return trainingPuzzles.length;
	}
}

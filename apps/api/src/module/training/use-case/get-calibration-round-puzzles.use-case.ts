import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { Puzzle } from '../../puzzle/puzzle.entity';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { TrainingCalibrationPuzzleRepository } from '../training-calibration-puzzle.repository';
import { TrainingCalibrationRoundRepository } from '../training-calibration-round.repository';
import { Training } from '../training.entity';

@Injectable()
export class GetCalibrationRoundPuzzlesUseCase {
	constructor(
		private readonly calibrationRoundRepository: TrainingCalibrationRoundRepository,
		private readonly calibrationPuzzleRepository: TrainingCalibrationPuzzleRepository,
		private readonly puzzleAttemptRepository: PuzzleAttemptRepository,
	) {}

	async execute(training: Training, roundUuid: string): Promise<Puzzle[]> {
		const round = await this.calibrationRoundRepository.getOne({ uuid: roundUuid });

		if (round.training.uuid !== training.uuid) {
			throw new ForbiddenException('not allowed', 'calibration');
		}

		const dealt = await this.calibrationPuzzleRepository.getManyByRound(round.uuid);
		const attempts = await this.puzzleAttemptRepository.getManyByCalibrationRound(round.uuid);

		const attempted = new Set(attempts.map((attempt) => attempt.puzzle.uuid));

		return dealt
			.filter((calibrationPuzzle) => !attempted.has(calibrationPuzzle.puzzle.uuid))
			.map((calibrationPuzzle) => calibrationPuzzle.puzzle);
	}
}

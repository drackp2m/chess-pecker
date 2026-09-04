import { Inject, Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { CalibrationRoundPuzzles } from '../definition/calibration-round-puzzles.interface';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { TrainingCalibrationPuzzleRepository } from '../training-calibration-puzzle.repository';
import { TrainingCalibrationRoundRepository } from '../training-calibration-round.repository';
import { Training } from '../training.entity';

@Injectable()
export class GetCalibrationRoundPuzzlesUseCase {
	constructor(
		@Inject(TrainingCalibrationRoundRepository)
		private readonly calibrationRoundRepository: TrainingCalibrationRoundRepository,
		@Inject(TrainingCalibrationPuzzleRepository)
		private readonly calibrationPuzzleRepository: TrainingCalibrationPuzzleRepository,
		@Inject(PuzzleAttemptRepository)
		private readonly puzzleAttemptRepository: PuzzleAttemptRepository,
	) {}

	/**
	 * Resuming a half-finished round is what an F5 does, and what is left to attempt does not
	 * say where it stood, which is why the whole deal travels with the response.
	 */
	async execute(training: Training, roundUuid: string): Promise<CalibrationRoundPuzzles> {
		const round = await this.calibrationRoundRepository.getOne({ uuid: roundUuid });

		if (round.training.uuid !== training.uuid) {
			throw new ForbiddenException('not allowed', 'calibration');
		}

		const dealt = await this.calibrationPuzzleRepository.getManyByRound(round.uuid);
		const attempts = await this.puzzleAttemptRepository.getManyByCalibrationRound(round.uuid);

		const attemptedUuids = new Set(attempts.map((attempt) => attempt.puzzle.uuid));

		const puzzles = dealt
			.filter((calibrationPuzzle) => !attemptedUuids.has(calibrationPuzzle.puzzle.uuid))
			.map((calibrationPuzzle) => calibrationPuzzle.puzzle);

		return { total: dealt.length, attempted: dealt.length - puzzles.length, puzzles };
	}
}

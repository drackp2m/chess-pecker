import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { CalibrationRoundPuzzles } from '../definition/calibration-round-puzzles.interface';
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

	/**
	 * Reanudar una ronda a medias es lo que hace un F5, y lo que quedaba por intentar no
	 * dice por sí solo por dónde iba: de ahí que el reparto entero viaje con la respuesta.
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

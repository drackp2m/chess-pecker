import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { CalibrationRoundOutcome } from '../definition/calibration-round-outcome.enum';
import { PuzzleAttemptKind } from '../definition/puzzle-attempt-kind.enum';
import { SubmitCalibrationAttemptRequestDto } from '../dto/request/submit-calibration-attempt-request.dto';
import { PuzzleAttempt } from '../puzzle-attempt.entity';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { TrainingCalibrationPuzzleRepository } from '../training-calibration-puzzle.repository';
import { TrainingCalibrationRoundRepository } from '../training-calibration-round.repository';
import { Training } from '../training.entity';

import { ApplySyncTimestampsUseCase } from './apply-sync-timestamps.use-case';
import { CloseCalibrationRoundUseCase } from './close-calibration-round.use-case';

@Injectable()
export class SubmitCalibrationAttemptUseCase {
	constructor(
		private readonly puzzleAttemptRepository: PuzzleAttemptRepository,
		private readonly calibrationRoundRepository: TrainingCalibrationRoundRepository,
		private readonly calibrationPuzzleRepository: TrainingCalibrationPuzzleRepository,
		private readonly closeCalibrationRoundUseCase: CloseCalibrationRoundUseCase,
		private readonly applySyncTimestampsUseCase: ApplySyncTimestampsUseCase,
	) {}

	async execute(
		training: Training,
		submitRequest: SubmitCalibrationAttemptRequestDto,
	): Promise<{ attempt: PuzzleAttempt; outcome: CalibrationRoundOutcome }> {
		const round = await this.calibrationRoundRepository.getOne({
			uuid: submitRequest.roundUuid,
		});

		if (round.training.uuid !== training.uuid) {
			throw new ForbiddenException('not allowed', 'calibration');
		}

		if (CalibrationRoundOutcome.Pending !== round.outcome) {
			throw new PreconditionFailedException('already closed', 'calibration');
		}

		const dealt = await this.calibrationPuzzleRepository.getManyByRound(round.uuid);

		const calibrationPuzzle = dealt.find(
			(candidate) => candidate.puzzle.uuid === submitRequest.puzzleUuid,
		);

		if (undefined === calibrationPuzzle) {
			throw new PreconditionFailedException('not dealt in this round', 'puzzle');
		}

		const previous = await this.puzzleAttemptRepository.getManyByCalibrationRound(round.uuid);

		if (previous.some((attempt) => attempt.puzzle.uuid === submitRequest.puzzleUuid)) {
			throw new PreconditionFailedException('already attempted', 'puzzle');
		}

		const attempt = this.applySyncTimestampsUseCase.execute(
			new PuzzleAttempt({
				training,
				kind: PuzzleAttemptKind.Calibration,
				calibrationRound: round,
				puzzle: calibrationPuzzle.puzzle,
				durationMs: submitRequest.durationMs,
				solved: submitRequest.solved,
			}),
			submitRequest,
		);

		await this.puzzleAttemptRepository.insert(attempt);

		const attempts = [...previous, attempt];

		if (attempts.length < dealt.length) {
			return { attempt, outcome: CalibrationRoundOutcome.Pending };
		}

		const rounds = await this.calibrationRoundRepository.getManyByTraining(training.uuid);

		const outcome = await this.closeCalibrationRoundUseCase.execute(
			round,
			attempts,
			rounds.filter((other) => other.uuid !== round.uuid),
		);

		return { attempt, outcome };
	}
}

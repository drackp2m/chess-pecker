import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { PuzzleRepository } from '../../puzzle/puzzle.repository';
import { CalibrationRoundKind } from '../definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from '../definition/calibration-round-outcome.enum';
import { PuzzleAttemptKind } from '../definition/puzzle-attempt-kind.enum';
import { TrainingPolicy } from '../definition/training-policy';
import { SubmitCalibrationAttemptRequestDto } from '../dto/request/submit-calibration-attempt-request.dto';
import { PuzzleAttempt } from '../puzzle-attempt.entity';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { TrainingCalibrationRoundRepository } from '../training-calibration-round.repository';
import { Training } from '../training.entity';

import { ApplySyncTimestampsUseCase } from './apply-sync-timestamps.use-case';
import { CloseCalibrationRoundUseCase } from './close-calibration-round.use-case';

@Injectable()
export class SubmitCalibrationAttemptUseCase {
	constructor(
		private readonly puzzleAttemptRepository: PuzzleAttemptRepository,
		private readonly calibrationRoundRepository: TrainingCalibrationRoundRepository,
		private readonly puzzleRepository: PuzzleRepository,
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

		const puzzle = await this.puzzleRepository.getOne({ uuid: submitRequest.puzzleUuid });

		const attempt = this.applySyncTimestampsUseCase.execute(
			new PuzzleAttempt({
				training,
				kind: PuzzleAttemptKind.Calibration,
				calibrationRound: round,
				puzzle,
				durationMs: submitRequest.durationMs,
				solved: submitRequest.solved,
			}),
			submitRequest,
		);

		await this.puzzleAttemptRepository.insert(attempt);

		const attempts = await this.puzzleAttemptRepository.getManyByCalibrationRound(round.uuid);
		const expected = CalibrationRoundKind.Scan === round.kind ? 1 : TrainingPolicy.refinePuzzles;

		if (attempts.length < expected) {
			return { attempt, outcome: CalibrationRoundOutcome.Pending };
		}

		const rounds = await this.calibrationRoundRepository.getManyByTraining(training.uuid);

		const outcome = await this.closeCalibrationRoundUseCase.execute(
			round,
			attempts,
			rounds.filter((previous) => previous.uuid !== round.uuid),
		);

		return { attempt, outcome };
	}
}

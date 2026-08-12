import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { Puzzle } from '../../puzzle/puzzle.entity';
import { CalibrationRoundOutcome } from '../definition/calibration-round-outcome.enum';
import { PuzzleAttemptKind } from '../definition/puzzle-attempt-kind.enum';
import { SubmitCalibrationAttemptRequestDto } from '../dto/request/submit-calibration-attempt-request.dto';
import { PuzzleAttempt } from '../puzzle-attempt.entity';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { TrainingCalibrationPuzzle } from '../training-calibration-puzzle.entity';
import { TrainingCalibrationPuzzleRepository } from '../training-calibration-puzzle.repository';
import { TrainingCalibrationRound } from '../training-calibration-round.entity';
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
		const round = await this.resolveOpenRound(training, submitRequest.roundUuid);
		const dealt = await this.calibrationPuzzleRepository.getManyByRound(round.uuid);
		const puzzle = SubmitCalibrationAttemptUseCase.resolveDealtPuzzle(dealt, submitRequest);

		const previous = await this.puzzleAttemptRepository.getManyByCalibrationRound(round.uuid);

		if (previous.some((attempt) => attempt.puzzle.uuid === submitRequest.puzzleUuid)) {
			throw new PreconditionFailedException('already attempted', 'puzzle');
		}

		const attempt = this.buildAttempt(training, round, puzzle, submitRequest);

		await this.puzzleAttemptRepository.insert(attempt);

		const attempts = [...previous, attempt];

		if (attempts.length < dealt.length) {
			return { attempt, outcome: CalibrationRoundOutcome.Pending };
		}

		return { attempt, outcome: await this.closeRound(training, round, attempts) };
	}

	private static resolveDealtPuzzle(
		dealt: TrainingCalibrationPuzzle[],
		submitRequest: SubmitCalibrationAttemptRequestDto,
	): Puzzle {
		const calibrationPuzzle = dealt.find(
			(candidate) => candidate.puzzle.uuid === submitRequest.puzzleUuid,
		);

		if (undefined === calibrationPuzzle) {
			throw new PreconditionFailedException('not dealt in this round', 'puzzle');
		}

		return calibrationPuzzle.puzzle;
	}

	private buildAttempt(
		training: Training,
		round: TrainingCalibrationRound,
		puzzle: Puzzle,
		submitRequest: SubmitCalibrationAttemptRequestDto,
	): PuzzleAttempt {
		return this.applySyncTimestampsUseCase.execute(
			new PuzzleAttempt({
				training,
				kind: PuzzleAttemptKind.Calibration,
				calibrationRound: round,
				puzzle,
				durationMs: submitRequest.durationMs,
				solved: submitRequest.solved,
				closure: submitRequest.closure,
				hintUsed: submitRequest.hintUsed,
				mistakeCount: submitRequest.mistakeCount,
				record: submitRequest.record,
				explorations: submitRequest.explorations,
			}),
			submitRequest,
		);
	}

	/** El último intento cierra la ronda, que se juzga contra lo que dijeron las anteriores. */
	private async closeRound(
		training: Training,
		round: TrainingCalibrationRound,
		attempts: PuzzleAttempt[],
	): Promise<CalibrationRoundOutcome> {
		const rounds = await this.calibrationRoundRepository.getManyByTraining(training.uuid);

		return this.closeCalibrationRoundUseCase.execute(
			round,
			attempts,
			rounds.filter((other) => other.uuid !== round.uuid),
		);
	}

	/** La ronda que se está intentando, siempre que sea de este entrenamiento y siga abierta. */
	private async resolveOpenRound(
		training: Training,
		roundUuid: string,
	): Promise<TrainingCalibrationRound> {
		const round = await this.calibrationRoundRepository.getOne({ uuid: roundUuid });

		if (round.training.uuid !== training.uuid) {
			throw new ForbiddenException('not allowed', 'calibration');
		}

		if (CalibrationRoundOutcome.Pending !== round.outcome) {
			throw new PreconditionFailedException('already closed', 'calibration');
		}

		return round;
	}
}

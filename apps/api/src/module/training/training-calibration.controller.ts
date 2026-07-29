import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { Puzzle } from '../puzzle/puzzle.entity';
import { User } from '../user/user.entity';

import { CalibrationRoundOutcome } from './definition/calibration-round-outcome.enum';
import { SubmitCalibrationAttemptRequestDto } from './dto/request/submit-calibration-attempt-request.dto';
import { PuzzleAttempt } from './puzzle-attempt.entity';
import { TrainingCalibrationRound } from './training-calibration-round.entity';
import { TrainingCalibrationRoundRepository } from './training-calibration-round.repository';
import { CreateCalibrationRoundUseCase } from './use-case/create-calibration-round.use-case';
import { GetOwnedTrainingUseCase } from './use-case/get-owned-training.use-case';
import { SubmitCalibrationAttemptUseCase } from './use-case/submit-calibration-attempt.use-case';

@Controller('training/:uuid/calibration')
export class TrainingCalibrationController {
	constructor(
		private readonly getOwnedTrainingUseCase: GetOwnedTrainingUseCase,
		private readonly createCalibrationRoundUseCase: CreateCalibrationRoundUseCase,
		private readonly submitCalibrationAttemptUseCase: SubmitCalibrationAttemptUseCase,
		private readonly calibrationRoundRepository: TrainingCalibrationRoundRepository,
	) {}

	@Get('round')
	async listRounds(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
	): Promise<TrainingCalibrationRound[]> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.calibrationRoundRepository.getManyByTraining(training.uuid);
	}

	/**
	 * Abre la siguiente ronda y devuelve sus ejercicios: uno si es sondeo, diez si es
	 * afinado. Qué franja toca lo decide el servidor con lo que dijeron las anteriores.
	 */
	@Post('round')
	async createRound(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
	): Promise<{ round: TrainingCalibrationRound; puzzles: Puzzle[] }> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.createCalibrationRoundUseCase.execute(training);
	}

	/**
	 * Al completarse los intentos de la ronda, la respuesta trae ya su decisión: subir, bajar
	 * o aceptar la franja. `pending` significa que aún faltan ejercicios.
	 */
	@Post('attempt')
	async submitAttempt(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
		@Body() submitRequest: SubmitCalibrationAttemptRequestDto,
	): Promise<{ attempt: PuzzleAttempt; outcome: CalibrationRoundOutcome }> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.submitCalibrationAttemptUseCase.execute(training, submitRequest);
	}
}

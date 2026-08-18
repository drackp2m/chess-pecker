import { Controller, Get, Param } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { CalibrationRoundPuzzles } from './definition/calibration-round-puzzles.interface';
import { TrainingCalibrationRound } from './training-calibration-round.entity';
import { TrainingCalibrationRoundRepository } from './training-calibration-round.repository';
import { GetCalibrationRoundPuzzlesUseCase } from './use-case/get-calibration-round-puzzles.use-case';
import { GetOwnedTrainingUseCase } from './use-case/get-owned-training.use-case';

/**
 * Sólo lecturas: quién abre una ronda y qué decide con ella es del dispositivo, que es donde
 * vive el dominio desde que la aplicación es local-first. Lo que se escribe entra por
 * `POST /sync/training`.
 */
@Controller('training/:uuid/calibration')
export class TrainingCalibrationController {
	constructor(
		private readonly getOwnedTrainingUseCase: GetOwnedTrainingUseCase,
		private readonly getCalibrationRoundPuzzlesUseCase: GetCalibrationRoundPuzzlesUseCase,
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

	/** Los que faltan por intentar de una ronda abierta, con el tamaño del reparto entero. */
	@Get('round/:roundUuid/puzzle')
	async listRoundPuzzles(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
		@Param('roundUuid') roundUuid: string,
	): Promise<CalibrationRoundPuzzles> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.getCalibrationRoundPuzzlesUseCase.execute(training, roundUuid);
	}
}

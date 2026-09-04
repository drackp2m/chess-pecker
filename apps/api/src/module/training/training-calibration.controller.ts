import { Controller, Get, Inject, Param } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { CalibrationRoundPuzzles } from './definition/calibration-round-puzzles.interface';
import { TrainingCalibrationRound } from './training-calibration-round.entity';
import { TrainingCalibrationRoundRepository } from './training-calibration-round.repository';
import { GetCalibrationRoundPuzzlesUseCase } from './use-case/get-calibration-round-puzzles.use-case';
import { GetOwnedTrainingUseCase } from './use-case/get-owned-training.use-case';

/**
 * Reads only: opening a round and deciding on it belong to the device, where the domain
 * lives. Everything written comes in through `POST /sync/training`.
 */
@Controller('training/:uuid/calibration')
export class TrainingCalibrationController {
	constructor(
		@Inject(GetOwnedTrainingUseCase)
		private readonly getOwnedTrainingUseCase: GetOwnedTrainingUseCase,
		@Inject(GetCalibrationRoundPuzzlesUseCase)
		private readonly getCalibrationRoundPuzzlesUseCase: GetCalibrationRoundPuzzlesUseCase,
		@Inject(TrainingCalibrationRoundRepository)
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

	/** What is left to attempt in an open round, with the size of the whole deal. */
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

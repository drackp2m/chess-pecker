import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { TrainingActivity } from './definition/training-activity.interface';
import { TrainingAttemptHistory } from './definition/training-attempt-history.interface';
import { TrainingProgress } from './definition/training-progress.interface';
import { GetTrainingActivityRequestDto } from './dto/request/get-training-activity-request.dto';
import { GetTrainingAttemptsRequestDto } from './dto/request/get-training-attempts-request.dto';
import { Training } from './training.entity';
import { FinishTrainingUseCase } from './use-case/finish-training.use-case';
import { GetOwnedTrainingUseCase } from './use-case/get-owned-training.use-case';
import { GetTrainingActivityUseCase } from './use-case/get-training-activity.use-case';
import { GetTrainingProgressUseCase } from './use-case/get-training-progress.use-case';
import { ListTrainingAttemptsUseCase } from './use-case/list-training-attempts.use-case';
import { ListTrainingsUseCase } from './use-case/list-trainings.use-case';
import { StartTrainingUseCase } from './use-case/start-training.use-case';

@Controller('training')
export class TrainingController {
	constructor(
		private readonly startTrainingUseCase: StartTrainingUseCase,
		private readonly listTrainingsUseCase: ListTrainingsUseCase,
		private readonly getOwnedTrainingUseCase: GetOwnedTrainingUseCase,
		private readonly getTrainingProgressUseCase: GetTrainingProgressUseCase,
		private readonly getTrainingActivityUseCase: GetTrainingActivityUseCase,
		private readonly listTrainingAttemptsUseCase: ListTrainingAttemptsUseCase,
		private readonly finishTrainingUseCase: FinishTrainingUseCase,
	) {}

	@Get()
	async list(@CurrentUser() user: User): Promise<Training[]> {
		return this.listTrainingsUseCase.execute(user);
	}

	/** Aggregated over every training of the user, so it comes before `:uuid`. */
	@Get('activity')
	async getActivity(
		@CurrentUser() user: User,
		@Query() query: GetTrainingActivityRequestDto,
	): Promise<TrainingActivity> {
		return this.getTrainingActivityUseCase.execute(user, query);
	}

	@Post()
	async start(@CurrentUser() user: User): Promise<Training> {
		return this.startTrainingUseCase.execute(user);
	}

	@Get(':uuid')
	async getOne(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<Training> {
		return this.getOwnedTrainingUseCase.execute(user, uuid);
	}

	@Get(':uuid/progress')
	async getProgress(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
	): Promise<TrainingProgress> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.getTrainingProgressUseCase.execute(training);
	}

	/**
	 * The closed-exercise history a bare device rebuilds from, so the exercise travels inside
	 * each attempt: whoever asks may not have it in their catalogue.
	 */
	@Get(':uuid/attempt')
	async listAttempts(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
		@Query() query: GetTrainingAttemptsRequestDto,
	): Promise<TrainingAttemptHistory> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.listTrainingAttemptsUseCase.execute(training, query);
	}

	/** Marking it complete, which demands the minimum cycles are closed. */
	@Post(':uuid/finish')
	@HttpCode(HttpStatus.NO_CONTENT)
	async finish(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<void> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.finishTrainingUseCase.execute(training, false);
	}

	/** Cancelling it, allowed at any time. Nothing is deleted: the history still serves. */
	@Delete(':uuid')
	@HttpCode(HttpStatus.NO_CONTENT)
	async cancel(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<void> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.finishTrainingUseCase.execute(training, true);
	}
}

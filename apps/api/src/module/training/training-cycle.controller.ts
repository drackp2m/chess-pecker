import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { SubmitCycleAttemptRequestDto } from './dto/request/submit-cycle-attempt-request.dto';
import { PuzzleAttempt } from './puzzle-attempt.entity';
import { TrainingCycleItem } from './training-cycle-item.entity';
import { TrainingCycle } from './training-cycle.entity';
import { TrainingCycleRepository } from './training-cycle.repository';
import { GetNextCycleItemUseCase } from './use-case/get-next-cycle-item.use-case';
import { GetOwnedTrainingUseCase } from './use-case/get-owned-training.use-case';
import { StartNextCycleUseCase } from './use-case/start-next-cycle.use-case';
import { SubmitCycleAttemptUseCase } from './use-case/submit-cycle-attempt.use-case';

@Controller('training/:uuid/cycle')
export class TrainingCycleController {
	constructor(
		private readonly getOwnedTrainingUseCase: GetOwnedTrainingUseCase,
		private readonly startNextCycleUseCase: StartNextCycleUseCase,
		private readonly getNextCycleItemUseCase: GetNextCycleItemUseCase,
		private readonly submitCycleAttemptUseCase: SubmitCycleAttemptUseCase,
		private readonly trainingCycleRepository: TrainingCycleRepository,
	) {}

	@Get()
	async list(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<TrainingCycle[]> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.trainingCycleRepository.getManyByTraining(training.uuid);
	}

	/** Abre la siguiente pasada, con su propio orden materializado sobre el mismo set. */
	@Post()
	async start(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<TrainingCycle> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.startNextCycleUseCase.execute(training);
	}

	/** El ejercicio que toca ahora. 404 cuando la pasada ya está entera. */
	@Get('next')
	async next(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<TrainingCycleItem> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);
		const item = await this.getNextCycleItemUseCase.execute(training);

		if (undefined === item) {
			throw new NotFoundException('cycle completed');
		}

		return item;
	}

	@Post('attempt')
	async submitAttempt(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
		@Body() submitRequest: SubmitCycleAttemptRequestDto,
	): Promise<{ attempt: PuzzleAttempt; cycleFinished: boolean }> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.submitCycleAttemptUseCase.execute(training, submitRequest);
	}
}

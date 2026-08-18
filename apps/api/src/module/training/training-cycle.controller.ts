import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { TrainingCycleItem } from './training-cycle-item.entity';
import { TrainingCycle } from './training-cycle.entity';
import { TrainingCycleRepository } from './training-cycle.repository';
import { GetNextCycleItemUseCase } from './use-case/get-next-cycle-item.use-case';
import { GetOwnedTrainingUseCase } from './use-case/get-owned-training.use-case';

/**
 * Sólo lecturas: abrir una pasada y decidir qué hueco toca es del dispositivo. Lo que se
 * escribe entra por `POST /sync/training`.
 */
@Controller('training/:uuid/cycle')
export class TrainingCycleController {
	constructor(
		private readonly getOwnedTrainingUseCase: GetOwnedTrainingUseCase,
		private readonly getNextCycleItemUseCase: GetNextCycleItemUseCase,
		private readonly trainingCycleRepository: TrainingCycleRepository,
	) {}

	@Get()
	async list(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<TrainingCycle[]> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.trainingCycleRepository.getManyByTraining(training.uuid);
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
}

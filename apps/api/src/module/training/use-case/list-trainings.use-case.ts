import { Inject, Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { Training } from '../training.entity';
import { TrainingRepository } from '../training.repository';

@Injectable()
export class ListTrainingsUseCase {
	constructor(
		@Inject(TrainingRepository)
		private readonly trainingRepository: TrainingRepository,
	) {}

	async execute(user: User): Promise<Training[]> {
		return this.trainingRepository.getManyByUser(user.uuid);
	}
}

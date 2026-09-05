import { Inject, Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { User } from '../../user/user.entity';
import { Training } from '../training.entity';
import { TrainingRepository } from '../training.repository';

@Injectable()
export class StartTrainingUseCase {
	constructor(
		@Inject(TrainingRepository)
		private readonly trainingRepository: TrainingRepository,
	) {}

	/**
	 * Born calibrating with no declared ELO: the user is never asked their level, the
	 * calibration decides it, starting from a wide scan.
	 */
	async execute(user: User): Promise<Training> {
		const active = await this.trainingRepository.getActiveByUser(user.uuid);

		if (undefined !== active) {
			throw new PreconditionFailedException('already in progress', 'training');
		}

		return this.trainingRepository.insert(new Training({ user }));
	}
}

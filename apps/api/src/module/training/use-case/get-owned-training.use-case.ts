import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { User } from '../../user/user.entity';
import { Training } from '../training.entity';
import { TrainingRepository } from '../training.repository';

@Injectable()
export class GetOwnedTrainingUseCase {
	constructor(private readonly trainingRepository: TrainingRepository) {}

	/** Puerta de entrada de todo lo demás: existe y es tuyo, o no sigues. */
	async execute(user: User, trainingUuid: string): Promise<Training> {
		const training = await this.trainingRepository.getOne({ uuid: trainingUuid });

		if (training.user.uuid !== user.uuid) {
			throw new ForbiddenException('not allowed', 'training');
		}

		return training;
	}
}

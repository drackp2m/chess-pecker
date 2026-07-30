import { Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { User } from '../../user/user.entity';
import { Training } from '../training.entity';
import { TrainingRepository } from '../training.repository';

@Injectable()
export class StartTrainingUseCase {
	constructor(private readonly trainingRepository: TrainingRepository) {}

	/**
	 * Nace calibrando y sin ELO declarado: al usuario no se le pregunta su nivel, lo decide
	 * la calibración empezando por un sondeo amplio.
	 */
	async execute(user: User): Promise<Training> {
		const active = await this.trainingRepository.getActiveByUser(user.uuid);

		if (undefined !== active) {
			throw new PreconditionFailedException('already in progress', 'training');
		}

		return this.trainingRepository.insert(new Training({ user }));
	}
}

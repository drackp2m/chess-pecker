import { Injectable } from '@nestjs/common';

import { BadRequestException } from '../../../shared/exception/bad-request.exception';
import { SetTrainingGoalRequestDto } from '../dto/request/set-training-goal-request.dto';
import { TrainingGoal } from '../training-goal.entity';
import { TrainingGoalRepository } from '../training-goal.repository';
import { Training } from '../training.entity';

import { ApplySyncTimestampsUseCase } from './apply-sync-timestamps.use-case';

@Injectable()
export class SetTrainingGoalUseCase {
	constructor(
		private readonly trainingGoalRepository: TrainingGoalRepository,
		private readonly applySyncTimestampsUseCase: ApplySyncTimestampsUseCase,
	) {}

	/**
	 * Cada cambio de objetivo es una fila nueva, no una modificación: así queda la diferencia
	 * entre cumplir el plan y haber ido moviendo la meta hasta que encajara.
	 */
	async execute(training: Training, goalRequest: SetTrainingGoalRequestDto): Promise<TrainingGoal> {
		if (undefined === goalRequest.puzzlesPerDay && undefined === goalRequest.endDate) {
			throw new BadRequestException('puzzlesPerDay or endDate is required', 'goal');
		}

		const goal = this.applySyncTimestampsUseCase.execute(
			new TrainingGoal({
				training,
				...(undefined !== goalRequest.puzzlesPerDay
					? { puzzlesPerDay: goalRequest.puzzlesPerDay }
					: {}),
				...(undefined !== goalRequest.endDate ? { endDate: goalRequest.endDate } : {}),
			}),
			goalRequest,
		);

		return this.trainingGoalRepository.insert(goal);
	}
}

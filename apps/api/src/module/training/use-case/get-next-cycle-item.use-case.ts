import { Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { TrainingCycleItem } from '../training-cycle-item.entity';
import { TrainingCycleItemRepository } from '../training-cycle-item.repository';
import { TrainingCycleRepository } from '../training-cycle.repository';
import { Training } from '../training.entity';

@Injectable()
export class GetNextCycleItemUseCase {
	constructor(
		private readonly trainingCycleRepository: TrainingCycleRepository,
		private readonly trainingCycleItemRepository: TrainingCycleItemRepository,
		private readonly puzzleAttemptRepository: PuzzleAttemptRepository,
	) {}

	/**
	 * The next exercise of the running cycle: the first by position with no attempt yet.
	 * `undefined` means the cycle is finished.
	 */
	async execute(training: Training): Promise<TrainingCycleItem | undefined> {
		const cycle = await this.trainingCycleRepository.getRunningByTraining(training.uuid);

		if (undefined === cycle) {
			throw new PreconditionFailedException('no cycle in progress', 'cycle');
		}

		const items = await this.trainingCycleItemRepository.getManyByCycle(cycle.uuid);
		const attempts = await this.puzzleAttemptRepository.getManyByCycle(cycle.uuid);

		const attempted = new Set(attempts.map((attempt) => attempt.cycleItem?.uuid));

		return items.find((item) => !attempted.has(item.uuid));
	}
}

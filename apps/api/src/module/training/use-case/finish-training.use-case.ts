import { Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { TrainingCycleStatus } from '../definition/training-cycle-status.enum';
import { TrainingFinishedReason } from '../definition/training-finished-reason.enum';
import { TrainingPolicy } from '../definition/training-policy';
import { TrainingStatus } from '../definition/training-status.enum';
import { TrainingCycleRepository } from '../training-cycle.repository';
import { Training } from '../training.entity';
import { TrainingRepository } from '../training.repository';

import { GetTrainingProgressUseCase } from './get-training-progress.use-case';

@Injectable()
export class FinishTrainingUseCase {
	constructor(
		private readonly trainingRepository: TrainingRepository,
		private readonly trainingCycleRepository: TrainingCycleRepository,
		private readonly getTrainingProgressUseCase: GetTrainingProgressUseCase,
	) {}

	/**
	 * Cancelling is always allowed; completing demands the minimum cycles the method rests on.
	 * The reason is stored because plateau, cap and giving up all end up equally finished.
	 */
	async execute(training: Training, cancel: boolean): Promise<void> {
		if ([TrainingStatus.Finished, TrainingStatus.Cancelled].includes(training.status)) {
			throw new PreconditionFailedException('already finished', 'training');
		}

		const now = new Date();

		if (cancel) {
			await this.closeRunningCycle(training);
			await this.trainingRepository.finish(training.uuid, TrainingFinishedReason.Cancelled, now);

			return;
		}

		const progress = await this.getTrainingProgressUseCase.execute(training);
		const completed = progress.cycles.filter(
			(cycle) => 0 < cycle.total && cycle.attempted === cycle.total,
		);

		if (completed.length < progress.cycles.length) {
			throw new PreconditionFailedException('cycle in progress', 'cycle');
		}

		if (completed.length < TrainingPolicy.minCycles) {
			throw new PreconditionFailedException('not enough cycles', 'cycle');
		}

		const reason = progress.suggestFinish
			? TrainingFinishedReason.Plateau
			: TrainingFinishedReason.Completed;

		await this.trainingRepository.finish(training.uuid, reason, now);
	}

	private async closeRunningCycle(training: Training): Promise<void> {
		const running = await this.trainingCycleRepository.getRunningByTraining(training.uuid);

		if (undefined !== running) {
			await this.trainingCycleRepository.updateStatus(running.uuid, TrainingCycleStatus.Cancelled);
		}
	}
}

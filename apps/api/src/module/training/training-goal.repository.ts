import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { TrainingGoal } from './training-goal.entity';

export class TrainingGoalRepository extends CustomRepository<TrainingGoal> {
	/** The current goal is the last one set; the earlier ones are kept. */
	async getCurrentByTraining(trainingUuid: string): Promise<TrainingGoal | undefined> {
		const goals = await this.getMany(
			{ training: trainingUuid },
			{ orderBy: { createdAt: 'desc' }, limit: 1 },
		);

		return 0 < goals.length ? goals[0] : undefined;
	}

	async getManyByTraining(trainingUuid: string): Promise<TrainingGoal[]> {
		return this.getMany({ training: trainingUuid }, { orderBy: { createdAt: 'asc' } });
	}
}

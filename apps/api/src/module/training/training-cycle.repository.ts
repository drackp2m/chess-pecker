import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { TrainingCycleStatus } from './definition/training-cycle-status.enum';
import { TrainingCycle } from './training-cycle.entity';

export class TrainingCycleRepository extends CustomRepository<TrainingCycle> {
	async getManyByTraining(trainingUuid: string): Promise<TrainingCycle[]> {
		return this.getMany({ training: trainingUuid }, { orderBy: { index: 'asc' } });
	}

	async getRunningByTraining(trainingUuid: string): Promise<TrainingCycle | undefined> {
		const cycles = await this.getMany({
			training: trainingUuid,
			status: TrainingCycleStatus.Running,
		});

		return 0 < cycles.length ? cycles[0] : undefined;
	}

	async updateStatus(uuid: string, status: TrainingCycleStatus): Promise<void> {
		await this.entityManager.fork().nativeUpdate(TrainingCycle, { uuid }, { status });
	}
}

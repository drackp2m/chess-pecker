import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { TrainingCycleItem } from './training-cycle-item.entity';

export class TrainingCycleItemRepository extends CustomRepository<TrainingCycleItem> {
	/** El orden se materializa entero al crear el ciclo, con una inserción masiva. */
	async insertMany(items: TrainingCycleItem[]): Promise<TrainingCycleItem[]> {
		await this.entityManager.fork().persist(items).flush();

		return items;
	}

	async getManyByCycle(cycleUuid: string): Promise<TrainingCycleItem[]> {
		return this.getMany(
			{ cycle: cycleUuid },
			{ orderBy: { position: 'asc' }, populate: ['trainingPuzzle.puzzle'] },
		);
	}

	async getManyByTraining(
		trainingUuid: string,
		receivedAfter?: Date,
	): Promise<TrainingCycleItem[]> {
		return this.getMany(
			{
				cycle: { training: trainingUuid },
				...(undefined === receivedAfter ? {} : { receivedAt: { $gt: receivedAfter } }),
			},
			{ orderBy: { position: 'asc' }, populate: ['trainingPuzzle.puzzle'] },
		);
	}

	async countByCycle(cycleUuid: string): Promise<number> {
		return this.entityManager.fork().count(TrainingCycleItem, { cycle: cycleUuid });
	}
}

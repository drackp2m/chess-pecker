import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { TrainingPuzzle } from './training-puzzle.entity';

export class TrainingPuzzleRepository extends CustomRepository<TrainingPuzzle> {
	/** El set entra de golpe: son X filas de una sentada, no X inserts. */
	async insertMany(trainingPuzzles: TrainingPuzzle[]): Promise<TrainingPuzzle[]> {
		await this.entityManager.fork().persist(trainingPuzzles).flush();

		return trainingPuzzles;
	}

	async getManyByTraining(trainingUuid: string): Promise<TrainingPuzzle[]> {
		return this.getMany({ training: trainingUuid }, { populate: ['puzzle'] });
	}

	async countByTraining(trainingUuid: string): Promise<number> {
		return this.entityManager.fork().count(TrainingPuzzle, { training: trainingUuid });
	}
}

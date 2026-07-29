import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { TrainingFinishedReason } from './definition/training-finished-reason.enum';
import { TrainingStatus } from './definition/training-status.enum';
import { Training } from './training.entity';

export class TrainingRepository extends CustomRepository<Training> {
	static readonly activeStatuses = [
		TrainingStatus.Calibrating,
		TrainingStatus.Planning,
		TrainingStatus.Running,
	];

	async getManyByUser(userUuid: string): Promise<Training[]> {
		return this.getMany({ user: userUuid }, { orderBy: { createdAt: 'desc' } });
	}

	async getActiveByUser(userUuid: string): Promise<Training | undefined> {
		const trainings = await this.getMany({
			user: userUuid,
			status: { $in: TrainingRepository.activeStatuses },
		});

		return 0 < trainings.length ? trainings[0] : undefined;
	}

	/**
	 * Actualización dirigida: el cambio de estado se dispara desde sitios que ya tienen el
	 * uuid pero no la entidad cargada, y así se ahorra el `select` previo.
	 */
	async updateStatus(uuid: string, status: TrainingStatus): Promise<void> {
		await this.entityManager.fork().nativeUpdate(Training, { uuid }, { status });
	}

	async finish(uuid: string, reason: TrainingFinishedReason, finishedAt: Date): Promise<void> {
		const status =
			TrainingFinishedReason.Cancelled === reason
				? TrainingStatus.Abandoned
				: TrainingStatus.Finished;

		await this.entityManager
			.fork()
			.nativeUpdate(Training, { uuid }, { status, finishedReason: reason, finishedAt });
	}
}

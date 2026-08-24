import { Injectable, inject } from '@angular/core';
import type {
	SetTrainingGoalRequest,
	TrainingFinishedReason,
	TrainingStatus,
} from '@chesspecker/api-definitions';

import { TrainingGoalRow, TrainingRow } from '@app/repository/definition/training-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { born, touch } from '@app/use-case/sync/local-record';

const ACTIVE_STATUSES: readonly TrainingStatus[] = ['calibrating', 'planning', 'running'];

export function isActiveTraining(training: TrainingRow): boolean {
	return ACTIVE_STATUSES.includes(training.status);
}

@Injectable({
	providedIn: 'root',
})
export class LocalTrainingUseCase {
	private readonly repository = inject(TrainingLocalRepository);

	async list(): Promise<readonly TrainingRow[]> {
		const rows = await this.repository.findAll('training');

		return rows.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
	}

	async find(uuid: string): Promise<TrainingRow | undefined> {
		return this.repository.find('training', uuid);
	}

	async findActive(): Promise<TrainingRow | undefined> {
		return (await this.list()).find((training) => isActiveTraining(training));
	}

	async start(): Promise<TrainingRow> {
		if (undefined !== (await this.findActive())) {
			throw new Error('A training is already in progress');
		}

		const now = new Date();

		return this.repository.insert(
			'training',
			born<TrainingRow>({
				uuid: crypto.randomUUID(),
				status: 'calibrating',
				createdAt: now,
				updatedAt: now,
			}),
		);
	}

	async save(training: TrainingRow): Promise<TrainingRow> {
		return this.repository.insert('training', training);
	}

	async updateStatus(uuid: string, status: TrainingStatus): Promise<TrainingRow | undefined> {
		const training = await this.find(uuid);

		if (undefined === training || status === training.status) {
			return training;
		}

		return this.save(touch({ ...training, status }));
	}

	async finish(
		uuid: string,
		status: TrainingStatus,
		finishedReason: TrainingFinishedReason,
	): Promise<TrainingRow | undefined> {
		const training = await this.find(uuid);

		if (undefined === training) {
			return undefined;
		}

		if ('finished' === training.status || 'cancelled' === training.status) {
			throw new Error('The training is already finished');
		}

		const now = new Date();

		return this.save(touch({ ...training, status, finishedReason, finishedAt: now }, now));
	}

	async listGoals(trainingUuid: string): Promise<readonly TrainingGoalRow[]> {
		const rows = await this.repository.findAllByIndex('trainingGoal', 'trainingUuid', trainingUuid);

		return rows.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
	}

	async currentGoal(trainingUuid: string): Promise<TrainingGoalRow | undefined> {
		return (await this.listGoals(trainingUuid)).at(-1);
	}

	async setGoal(trainingUuid: string, goal: SetTrainingGoalRequest): Promise<TrainingGoalRow> {
		const now = new Date();

		return this.repository.insert(
			'trainingGoal',
			born<TrainingGoalRow>({
				uuid: crypto.randomUUID(),
				trainingUuid,
				createdAt: now,
				updatedAt: now,
				...(undefined === goal.puzzlesPerDay ? {} : { puzzlesPerDay: goal.puzzlesPerDay }),
				...(undefined === goal.endDate ? {} : { endDate: goal.endDate }),
			}),
		);
	}
}

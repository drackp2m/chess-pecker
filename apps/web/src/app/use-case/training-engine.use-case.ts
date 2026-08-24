import { Injectable, inject } from '@angular/core';
import type { SetTrainingGoalRequest, TrainingProgress } from '@chesspecker/api-definitions';

import { TrainingPolicy } from '@app/definition/training-policy.constant';
import { TrainingRow } from '@app/repository/definition/training-schema.interface';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { LocalProgressUseCase } from '@app/use-case/local-progress.use-case';
import { LocalTrainingUseCase } from '@app/use-case/local-training.use-case';

@Injectable({
	providedIn: 'root',
})
export class TrainingEngineUseCase {
	private readonly trainings = inject(LocalTrainingUseCase);
	private readonly cycles = inject(LocalCycleUseCase);
	private readonly progress = inject(LocalProgressUseCase);

	async list(): Promise<readonly TrainingRow[]> {
		return this.trainings.list();
	}

	async getProgress(uuid: string): Promise<TrainingProgress> {
		return this.progress.build(uuid);
	}

	async start(): Promise<void> {
		await this.trainings.start();
	}

	async selectSet(uuid: string, size: number): Promise<number> {
		return this.cycles.selectSet(uuid, size);
	}

	async setGoal(uuid: string, goal: SetTrainingGoalRequest): Promise<void> {
		await this.trainings.setGoal(uuid, goal);
	}

	async startCycle(uuid: string): Promise<void> {
		await this.cycles.startCycle(uuid);
	}

	async finish(uuid: string): Promise<void> {
		const progress = await this.progress.build(uuid);
		const completed = progress.cycles.filter(
			(cycle) => 0 < cycle.total && cycle.attempted === cycle.total,
		);

		if (completed.length < progress.cycles.length) {
			throw new Error('A cycle is still in progress');
		}

		if (completed.length < TrainingPolicy.minCycles) {
			throw new Error('The training has not run enough cycles yet');
		}

		await this.trainings.finish(uuid, 'finished', progress.suggestFinish ? 'plateau' : 'completed');
	}

	async cancel(uuid: string): Promise<void> {
		await this.cycles.abandonRunningCycle(uuid);
		await this.trainings.finish(uuid, 'cancelled', 'cancelled');
	}
}

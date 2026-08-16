import { Injectable, inject } from '@angular/core';
import type { SetTrainingGoalRequest, TrainingProgress } from '@chesspecker/api-definitions';

import { TrainingPolicy } from '@app/definition/training-policy.constant';
import { TrainingRow } from '@app/repository/definition/training-schema.interface';
import { TrainingRunRepository } from '@app/repository/training-run.repository';
import { TrainingRepository } from '@app/repository/training.repository';
import { SessionStore } from '@app/store/session.store';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { LocalProgressUseCase } from '@app/use-case/local-progress.use-case';
import { LocalTrainingUseCase } from '@app/use-case/local-training.use-case';
import { TrainingMirrorUseCase } from '@app/use-case/training-mirror.use-case';

@Injectable({
	providedIn: 'root',
})
export class TrainingEngineUseCase {
	private readonly session = inject(SessionStore);
	private readonly remote = inject(TrainingRepository);
	private readonly runRemote = inject(TrainingRunRepository);
	private readonly mirror = inject(TrainingMirrorUseCase);
	private readonly trainings = inject(LocalTrainingUseCase);
	private readonly cycles = inject(LocalCycleUseCase);
	private readonly progress = inject(LocalProgressUseCase);

	isRemote(): boolean {
		return this.session.isAuthenticated();
	}

	async list(): Promise<readonly TrainingRow[]> {
		if (!this.isRemote()) {
			return this.trainings.list();
		}

		await this.mirror.trainings(await this.remote.list());

		return (await this.trainings.list()).filter((training) => undefined !== training.syncedAt);
	}

	async getProgress(uuid: string): Promise<TrainingProgress> {
		if (!this.isRemote()) {
			return this.progress.build(uuid);
		}

		const progress = await this.remote.getProgress(uuid);

		await this.mirror.cycles(
			uuid,
			progress.cycles.map((cycle) => ({
				uuid: cycle.uuid,
				index: cycle.index,
				status: cycle.status,
				createdAt: cycle.startedAt,
			})),
		);

		return progress;
	}

	async start(): Promise<void> {
		if (!this.isRemote()) {
			await this.trainings.start();

			return;
		}

		await this.mirror.training(await this.remote.start());
	}

	async selectSet(uuid: string, size: number): Promise<number> {
		return this.isRemote() ? this.remote.selectSet(uuid, size) : this.cycles.selectSet(uuid, size);
	}

	async setGoal(uuid: string, goal: SetTrainingGoalRequest): Promise<void> {
		if (!this.isRemote()) {
			await this.trainings.setGoal(uuid, goal);

			return;
		}

		await this.remote.setGoal(uuid, goal);
		await this.mirror.goal(uuid, goal);
	}

	async startCycle(uuid: string): Promise<void> {
		if (!this.isRemote()) {
			await this.cycles.startCycle(uuid);

			return;
		}

		await this.mirror.cycle(uuid, await this.runRemote.startCycle(uuid));
	}

	async finish(uuid: string): Promise<void> {
		if (this.isRemote()) {
			return this.remote.finish(uuid);
		}

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
		if (this.isRemote()) {
			return this.remote.cancel(uuid);
		}

		await this.cycles.abandonRunningCycle(uuid);
		await this.trainings.finish(uuid, 'abandoned', 'cancelled');
	}
}

import { Injectable, inject } from '@angular/core';
import type {
	SetTrainingGoalRequest,
	Training,
	TrainingProgress,
} from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class TrainingRepository {
	private readonly apiSdk = inject(ApiSdkService);

	async list(): Promise<readonly Training[]> {
		return this.apiSdk.GET.training('');
	}

	async start(): Promise<Training> {
		return this.apiSdk.POST.training('');
	}

	async getOne(uuid: string): Promise<Training> {
		return this.apiSdk.GET.training('/:uuid', { path: { uuid } });
	}

	async getProgress(uuid: string): Promise<TrainingProgress> {
		return this.apiSdk.GET.training('/:uuid/progress', { path: { uuid } });
	}

	/** Fixes the X exercises every cycle then runs over. Only possible once. */
	async selectSet(uuid: string, size: number): Promise<number> {
		const { size: selected } = await this.apiSdk.POST.training('/:uuid/set', {
			path: { uuid },
			params: { size },
		});

		return selected;
	}

	/** Append-only: every call adds a goal, and the current one is the last. */
	async setGoal(uuid: string, goal: SetTrainingGoalRequest): Promise<void> {
		await this.apiSdk.POST.training('/:uuid/goal', { path: { uuid }, params: goal });
	}

	async finish(uuid: string): Promise<void> {
		return this.apiSdk.POST.training('/:uuid/finish', { path: { uuid } });
	}

	async cancel(uuid: string): Promise<void> {
		return this.apiSdk.DELETE.training('/:uuid', { path: { uuid } });
	}
}

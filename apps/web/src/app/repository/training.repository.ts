import { Injectable, inject } from '@angular/core';
import type {
	GetTrainingAttemptsRequest,
	Training,
	TrainingActivity,
	TrainingAttemptHistory,
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

	/** Sin `since` vuelve el rango entero; con él, sólo los días tocados desde ese corte. */
	async getActivity(days: number, since?: string): Promise<TrainingActivity> {
		return this.apiSdk.GET.training('/activity', {
			query: undefined === since ? { days } : { days, since },
		});
	}

	/** Una página del histórico. Sin `since` empieza por el principio. */
	async listAttempts(
		uuid: string,
		query: GetTrainingAttemptsRequest,
	): Promise<TrainingAttemptHistory> {
		return this.apiSdk.GET.training('/:uuid/attempt', { path: { uuid }, query });
	}

	async finish(uuid: string): Promise<void> {
		return this.apiSdk.POST.training('/:uuid/finish', { path: { uuid } });
	}

	async cancel(uuid: string): Promise<void> {
		return this.apiSdk.DELETE.training('/:uuid', { path: { uuid } });
	}
}

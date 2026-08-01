import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '@app/definition/api.constant';
import {
	Training,
	TrainingGoalRequest,
	TrainingProgress,
} from '@app/definition/training.interface';

@Injectable({
	providedIn: 'root',
})
export class TrainingRepository {
	private readonly httpClient = inject(HttpClient);
	private readonly baseUrl = `${API_BASE_URL}/training`;

	async list(): Promise<Training[]> {
		return firstValueFrom(this.httpClient.get<Training[]>(this.baseUrl));
	}

	async start(): Promise<Training> {
		return firstValueFrom(this.httpClient.post<Training>(this.baseUrl, {}));
	}

	async getOne(uuid: string): Promise<Training> {
		return firstValueFrom(this.httpClient.get<Training>(`${this.baseUrl}/${uuid}`));
	}

	async getProgress(uuid: string): Promise<TrainingProgress> {
		return firstValueFrom(
			this.httpClient.get<TrainingProgress>(`${this.baseUrl}/${uuid}/progress`),
		);
	}

	/** Fixes the X exercises every cycle then runs over. Only possible once. */
	async selectSet(uuid: string, size: number): Promise<number> {
		const { size: selected } = await firstValueFrom(
			this.httpClient.post<{ size: number }>(`${this.baseUrl}/${uuid}/set`, { size }),
		);

		return selected;
	}

	/** Append-only: every call adds a goal, and the current one is the last. */
	async setGoal(uuid: string, goal: TrainingGoalRequest): Promise<void> {
		await firstValueFrom(this.httpClient.post(`${this.baseUrl}/${uuid}/goal`, goal));
	}

	async finish(uuid: string): Promise<void> {
		await firstValueFrom(this.httpClient.post(`${this.baseUrl}/${uuid}/finish`, {}));
	}

	async cancel(uuid: string): Promise<void> {
		await firstValueFrom(this.httpClient.delete(`${this.baseUrl}/${uuid}`));
	}
}

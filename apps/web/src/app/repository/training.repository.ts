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
		return firstValueFrom(this.httpClient.get<Training[]>(this.baseUrl, { withCredentials: true }));
	}

	async start(): Promise<Training> {
		return firstValueFrom(
			this.httpClient.post<Training>(this.baseUrl, {}, { withCredentials: true }),
		);
	}

	async getOne(uuid: string): Promise<Training> {
		return firstValueFrom(
			this.httpClient.get<Training>(`${this.baseUrl}/${uuid}`, { withCredentials: true }),
		);
	}

	async getProgress(uuid: string): Promise<TrainingProgress> {
		return firstValueFrom(
			this.httpClient.get<TrainingProgress>(`${this.baseUrl}/${uuid}/progress`, {
				withCredentials: true,
			}),
		);
	}

	/** Fixes the X exercises every cycle then runs over. Only possible once. */
	async selectSet(uuid: string, size: number): Promise<number> {
		const { size: selected } = await firstValueFrom(
			this.httpClient.post<{ size: number }>(
				`${this.baseUrl}/${uuid}/set`,
				{ size },
				{ withCredentials: true },
			),
		);

		return selected;
	}

	/** Append-only: every call adds a goal, and the current one is the last. */
	async setGoal(uuid: string, goal: TrainingGoalRequest): Promise<void> {
		await firstValueFrom(
			this.httpClient.post(`${this.baseUrl}/${uuid}/goal`, goal, { withCredentials: true }),
		);
	}

	async finish(uuid: string): Promise<void> {
		await firstValueFrom(
			this.httpClient.post(`${this.baseUrl}/${uuid}/finish`, {}, { withCredentials: true }),
		);
	}

	async cancel(uuid: string): Promise<void> {
		await firstValueFrom(
			this.httpClient.delete(`${this.baseUrl}/${uuid}`, { withCredentials: true }),
		);
	}
}

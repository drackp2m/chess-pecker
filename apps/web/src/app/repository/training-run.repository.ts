import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '@app/definition/api.constant';
import {
	CalibrationAttemptResult,
	CalibrationRound,
	CalibrationRoundPuzzles,
	CalibrationRoundStart,
	CycleAttemptResult,
	SubmitCalibrationAttemptRequest,
	SubmitCycleAttemptRequest,
	TrainingCycle,
	TrainingCycleItem,
} from '@app/definition/training.interface';

/**
 * Everything that happens while a training is being solved: the calibration rounds and
 * the cycles. Split off `TrainingRepository`, which only deals with the training itself.
 */
@Injectable({
	providedIn: 'root',
})
export class TrainingRunRepository {
	private readonly httpClient = inject(HttpClient);
	private readonly baseUrl = `${API_BASE_URL}/training`;

	async listRounds(uuid: string): Promise<CalibrationRound[]> {
		return firstValueFrom(
			this.httpClient.get<CalibrationRound[]>(`${this.baseUrl}/${uuid}/calibration/round`),
		);
	}

	/** Opens the next round and hands back its exercises: one to scan, ten to refine. */
	async createRound(uuid: string): Promise<CalibrationRoundStart> {
		return firstValueFrom(
			this.httpClient.post<CalibrationRoundStart>(`${this.baseUrl}/${uuid}/calibration/round`, {}),
		);
	}

	async listRoundPuzzles(uuid: string, roundUuid: string): Promise<CalibrationRoundPuzzles> {
		return firstValueFrom(
			this.httpClient.get<CalibrationRoundPuzzles>(
				`${this.baseUrl}/${uuid}/calibration/round/${roundUuid}/puzzle`,
			),
		);
	}

	async submitCalibrationAttempt(
		uuid: string,
		request: SubmitCalibrationAttemptRequest,
	): Promise<CalibrationAttemptResult> {
		return firstValueFrom(
			this.httpClient.post<CalibrationAttemptResult>(
				`${this.baseUrl}/${uuid}/calibration/attempt`,
				request,
			),
		);
	}

	async listCycles(uuid: string): Promise<TrainingCycle[]> {
		return firstValueFrom(this.httpClient.get<TrainingCycle[]>(`${this.baseUrl}/${uuid}/cycle`));
	}

	async startCycle(uuid: string): Promise<TrainingCycle> {
		return firstValueFrom(this.httpClient.post<TrainingCycle>(`${this.baseUrl}/${uuid}/cycle`, {}));
	}

	async getNextItem(uuid: string): Promise<TrainingCycleItem> {
		return firstValueFrom(
			this.httpClient.get<TrainingCycleItem>(`${this.baseUrl}/${uuid}/cycle/next`),
		);
	}

	async submitCycleAttempt(
		uuid: string,
		request: SubmitCycleAttemptRequest,
	): Promise<CycleAttemptResult> {
		return firstValueFrom(
			this.httpClient.post<CycleAttemptResult>(`${this.baseUrl}/${uuid}/cycle/attempt`, request),
		);
	}
}

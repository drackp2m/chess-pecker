import { Injectable, inject } from '@angular/core';
import type {
	CalibrationAttemptResult,
	CalibrationRound,
	CalibrationRoundPuzzles,
	CalibrationRoundStart,
	CycleAttemptResult,
	SubmitCalibrationAttemptRequest,
	SubmitCycleAttemptRequest,
	TrainingCycle,
	TrainingCycleItem,
} from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

/**
 * Everything that happens while a training is being solved: the calibration rounds and
 * the cycles. Split off `TrainingRepository`, which only deals with the training itself.
 */
@Injectable({
	providedIn: 'root',
})
export class TrainingRunRepository {
	private readonly apiSdk = inject(ApiSdkService);

	async listRounds(uuid: string): Promise<readonly CalibrationRound[]> {
		return this.apiSdk.GET.training('/:uuid/calibration/round', { path: { uuid } });
	}

	/** Opens the next round and hands back its exercises: one to scan, ten to refine. */
	async createRound(uuid: string): Promise<CalibrationRoundStart> {
		return this.apiSdk.POST.training('/:uuid/calibration/round', { path: { uuid } });
	}

	async listRoundPuzzles(uuid: string, roundUuid: string): Promise<CalibrationRoundPuzzles> {
		return this.apiSdk.GET.training('/:uuid/calibration/round/:roundUuid/puzzle', {
			path: { uuid, roundUuid },
		});
	}

	async submitCalibrationAttempt(
		uuid: string,
		request: SubmitCalibrationAttemptRequest,
	): Promise<CalibrationAttemptResult> {
		return this.apiSdk.POST.training('/:uuid/calibration/attempt', {
			path: { uuid },
			params: request,
		});
	}

	async listCycles(uuid: string): Promise<readonly TrainingCycle[]> {
		return this.apiSdk.GET.training('/:uuid/cycle', { path: { uuid } });
	}

	async startCycle(uuid: string): Promise<TrainingCycle> {
		return this.apiSdk.POST.training('/:uuid/cycle', { path: { uuid } });
	}

	async getNextItem(uuid: string): Promise<TrainingCycleItem> {
		return this.apiSdk.GET.training('/:uuid/cycle/next', { path: { uuid } });
	}

	async submitCycleAttempt(
		uuid: string,
		request: SubmitCycleAttemptRequest,
	): Promise<CycleAttemptResult> {
		return this.apiSdk.POST.training('/:uuid/cycle/attempt', { path: { uuid }, params: request });
	}
}

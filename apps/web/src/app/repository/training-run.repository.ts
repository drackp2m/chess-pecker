import { Injectable, inject } from '@angular/core';
import type {
	CalibrationRound,
	CalibrationRoundPuzzles,
	TrainingCycle,
	TrainingCycleItem,
} from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

/**
 * What the server knows about a calibration and its passes. Reads only: the device decides
 * all of it, and everything written comes in through `POST /sync/training`.
 */
@Injectable({
	providedIn: 'root',
})
export class TrainingRunRepository {
	private readonly apiSdk = inject(ApiSdkService);

	async listRounds(uuid: string): Promise<readonly CalibrationRound[]> {
		return this.apiSdk.GET.training('/:uuid/calibration/round', { path: { uuid } });
	}

	async listRoundPuzzles(uuid: string, roundUuid: string): Promise<CalibrationRoundPuzzles> {
		return this.apiSdk.GET.training('/:uuid/calibration/round/:roundUuid/puzzle', {
			path: { uuid, roundUuid },
		});
	}

	async listCycles(uuid: string): Promise<readonly TrainingCycle[]> {
		return this.apiSdk.GET.training('/:uuid/cycle', { path: { uuid } });
	}

	async getNextItem(uuid: string): Promise<TrainingCycleItem> {
		return this.apiSdk.GET.training('/:uuid/cycle/next', { path: { uuid } });
	}
}

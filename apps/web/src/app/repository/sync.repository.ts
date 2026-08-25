import { Injectable, inject } from '@angular/core';
import type {
	PushTrainingRequest,
	PushTrainingResult,
	SyncSummary,
	SyncTrainingTree,
} from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class SyncRepository {
	private readonly apiSdk = inject(ApiSdkService);

	/**
	 * What is on the other side, per table. Not cancelled on navigation: it is asked at boot,
	 * and the router's first navigation would cut the very call that opens the gate.
	 */
	async getSummary(): Promise<SyncSummary> {
		return this.apiSdk.GET.sync('', { cancellable: false });
	}

	async getTrainingTree(uuid: string, since?: string): Promise<SyncTrainingTree> {
		return this.apiSdk.GET.sync('/training/:uuid', {
			path: { uuid },
			query: undefined === since ? {} : { since },
			cancellable: false,
		});
	}

	/**
	 * A training's whole tree. Idempotent through `clientRef`, so repeating a push that was
	 * cut short returns the same uuids instead of duplicating anything.
	 */
	async pushTraining(request: PushTrainingRequest): Promise<PushTrainingResult> {
		return this.apiSdk.POST.sync('/training', { params: request });
	}
}

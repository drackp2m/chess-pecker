import { Injectable, inject } from '@angular/core';
import type { PushTrainingRequest, PushTrainingResult } from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class SyncRepository {
	private readonly apiSdk = inject(ApiSdkService);

	/**
	 * El árbol entero de un entrenamiento. Es idempotente por `clientRef`, así que repetir
	 * una subida que se cortó a mitad devuelve los mismos uuid en vez de duplicar nada.
	 */
	async pushTraining(request: PushTrainingRequest): Promise<PushTrainingResult> {
		return this.apiSdk.POST.sync('/training', { params: request });
	}
}

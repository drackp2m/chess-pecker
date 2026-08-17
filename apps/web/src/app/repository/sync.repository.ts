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
	 * Qué hay del otro lado, por tabla. No se cancela al navegar: se pregunta en el arranque,
	 * y la primera navegación del router cortaría justo la llamada que abre la puerta.
	 */
	async getSummary(): Promise<SyncSummary> {
		return this.apiSdk.GET.sync('', { cancellable: false });
	}

	async getTrainingTree(uuid: string): Promise<SyncTrainingTree> {
		return this.apiSdk.GET.sync('/training/:uuid', { path: { uuid }, cancellable: false });
	}

	/**
	 * El árbol entero de un entrenamiento. Es idempotente por `clientRef`, así que repetir
	 * una subida que se cortó a mitad devuelve los mismos uuid en vez de duplicar nada.
	 */
	async pushTraining(request: PushTrainingRequest): Promise<PushTrainingResult> {
		return this.apiSdk.POST.sync('/training', { params: request });
	}
}

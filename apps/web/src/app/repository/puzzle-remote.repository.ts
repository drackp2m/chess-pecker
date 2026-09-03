import { Injectable, inject } from '@angular/core';
import type { ApiPuzzle } from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class PuzzleRemoteRepository {
	private readonly apiSdk = inject(ApiSdkService);

	getOne(lichessId: string): Promise<ApiPuzzle> {
		return this.apiSdk.GET.puzzle('/:lichessId', { path: { lichessId } });
	}
}

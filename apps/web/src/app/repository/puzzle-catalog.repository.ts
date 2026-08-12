import { Injectable, inject } from '@angular/core';
import type { PuzzleCatalogPage } from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class PuzzleCatalogRepository {
	private readonly apiSdk = inject(ApiSdkService);

	async getPage(limit: number, after: string | null): Promise<PuzzleCatalogPage> {
		return this.apiSdk.GET.puzzle('/catalog', {
			query: null === after ? { limit } : { limit, after },
			cancellable: false,
		});
	}
}

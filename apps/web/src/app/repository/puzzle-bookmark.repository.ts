import { Injectable, inject } from '@angular/core';
import type { PuzzleBookmark, PuzzleBookmarkType } from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class PuzzleBookmarkRepository {
	private readonly apiSdk = inject(ApiSdkService);

	/**
	 * Uncancellable: the lists are pulled as a session opens, and logging in navigates right
	 * after, which would cut the trip off before it started.
	 */
	async list(): Promise<readonly PuzzleBookmark[]> {
		return this.apiSdk.GET.puzzleBookmark('', { cancellable: false });
	}

	/**
	 * `updatedAt` travels so the row does not arrive claiming to be newer than it is: one
	 * filed offline reaches the server whenever the trip is possible, not when it happened.
	 */
	async upsert(
		lichessId: string,
		type: PuzzleBookmarkType,
		updatedAt: Date,
	): Promise<PuzzleBookmark> {
		return this.apiSdk.PUT.puzzleBookmark('/:lichessId', {
			path: { lichessId },
			params: { type, updatedAt: updatedAt.toISOString() },
		});
	}

	async remove(lichessId: string): Promise<void> {
		return this.apiSdk.DELETE.puzzleBookmark('/:lichessId', { path: { lichessId } });
	}
}

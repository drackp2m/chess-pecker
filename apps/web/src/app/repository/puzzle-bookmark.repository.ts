import { Injectable, inject } from '@angular/core';
import type {
	PuzzleBookmark,
	PuzzleBookmarkHistoryEntry,
	PuzzleBookmarkType,
} from '@chesspecker/api-definitions';

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

	async history(): Promise<readonly PuzzleBookmarkHistoryEntry[]> {
		return this.apiSdk.GET.puzzleBookmark('/history', { cancellable: false });
	}

	/**
	 * `updatedAt` travels so the row does not arrive claiming to be newer than it is: one
	 * filed offline reaches the server whenever the trip is possible, not when it happened.
	 */
	async upsert(
		lichessId: string,
		type: PuzzleBookmarkType,
		updatedAt: Date,
		eventUuid?: string,
		attemptUuid?: string,
	): Promise<PuzzleBookmark> {
		return this.apiSdk.PUT.puzzleBookmark('/:lichessId', {
			path: { lichessId },
			params: {
				type,
				...(undefined === eventUuid ? {} : { eventUuid }),
				updatedAt: updatedAt.toISOString(),
				...(undefined === attemptUuid ? {} : { attemptUuid }),
			},
		});
	}

	async remove(
		lichessId: string,
		eventUuid?: string,
		attemptUuid?: string,
		updatedAt?: Date,
	): Promise<void> {
		return this.apiSdk.DELETE.puzzleBookmark('/:lichessId', {
			path: { lichessId },
			query: {
				...(undefined === eventUuid ? {} : { eventUuid }),
				...(undefined === attemptUuid ? {} : { attemptUuid }),
				...(undefined === updatedAt ? {} : { updatedAt: updatedAt.toISOString() }),
			},
		});
	}
}

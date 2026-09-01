import { Injectable, inject } from '@angular/core';
import type {
	CreatePuzzleShareRequest,
	GetSentPuzzleSharesRequest,
	PuzzleShare,
	PuzzleShareResultRequest,
} from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class PuzzleShareRepository {
	private readonly apiSdk = inject(ApiSdkService);

	/**
	 * One call however many friends it names. The modal only lets one through for now, but
	 * nothing here or on the API side is built around that.
	 */
	async create(request: CreatePuzzleShareRequest): Promise<PuzzleShare> {
		return this.apiSdk.POST.puzzleShare('', { params: request });
	}

	async listReceived(): Promise<readonly PuzzleShare[]> {
		return this.apiSdk.GET.puzzleShare('/received');
	}

	/**
	 * The replication feed of what this account sent, oldest first from the stamp given.
	 * Uncancellable: it is walked while a sync pass runs, and the router's navigation would
	 * cut a page out of the middle of it.
	 */
	async listSent(query: GetSentPuzzleSharesRequest = {}): Promise<readonly PuzzleShare[]> {
		return this.apiSdk.GET.puzzleShare('/sent', { query, cancellable: false });
	}

	async getOne(uuid: string): Promise<PuzzleShare> {
		return this.apiSdk.GET.puzzleShare('/:uuid', { path: { uuid } });
	}

	/** Answering a challenge. It counts once, so a second call comes back refused. */
	async submitAttempt(uuid: string, result: PuzzleShareResultRequest): Promise<PuzzleShare> {
		return this.apiSdk.POST.puzzleShare('/:uuid/attempt', { path: { uuid }, params: result });
	}
}

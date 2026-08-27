import { Injectable, inject } from '@angular/core';
import type {
	CreatePuzzleShareRequest,
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

	async listSent(): Promise<readonly PuzzleShare[]> {
		return this.apiSdk.GET.puzzleShare('/sent');
	}

	async getOne(uuid: string): Promise<PuzzleShare> {
		return this.apiSdk.GET.puzzleShare('/:uuid', { path: { uuid } });
	}

	/** Answering a challenge. It counts once, so a second call comes back refused. */
	async submitAttempt(uuid: string, result: PuzzleShareResultRequest): Promise<PuzzleShare> {
		return this.apiSdk.POST.puzzleShare('/:uuid/attempt', { path: { uuid }, params: result });
	}
}

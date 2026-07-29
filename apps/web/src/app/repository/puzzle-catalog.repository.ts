import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '@app/definition/api.constant';
import { ApiPuzzle } from '@app/definition/training.interface';

/**
 * The shared exercise catalog. Only needed to rebuild the exercises of a calibration
 * round that was left open: the round records the band it probed, not which exercises
 * it handed out, so resuming one means drawing a fresh set from the same band.
 */
@Injectable({
	providedIn: 'root',
})
export class PuzzleCatalogRepository {
	private readonly httpClient = inject(HttpClient);
	private readonly baseUrl = `${API_BASE_URL}/puzzle`;

	async searchByRating(ratingMin: number, ratingMax: number, limit: number): Promise<ApiPuzzle[]> {
		const params = new HttpParams()
			.set('ratingMin', ratingMin)
			.set('ratingMax', ratingMax)
			.set('limit', limit);

		return firstValueFrom(
			this.httpClient.get<ApiPuzzle[]>(this.baseUrl, { params, withCredentials: true }),
		);
	}
}

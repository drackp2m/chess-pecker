import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '@app/definition/api.constant';
import { UserSummary } from '@app/definition/user.interface';

@Injectable({
	providedIn: 'root',
})
export class UserRepository {
	private readonly httpClient = inject(HttpClient);
	private readonly baseUrl = `${API_BASE_URL}/user`;

	/**
	 * Prefix search over the username, which is what the friends screen needs to tell a
	 * typo from a stranger before sending a request. Never answers with yourself, and
	 * carries nothing but uuid and username.
	 */
	async search(username: string): Promise<UserSummary[]> {
		const params = new HttpParams().set('username', username);

		return firstValueFrom(this.httpClient.get<UserSummary[]>(this.baseUrl, { params }));
	}
}

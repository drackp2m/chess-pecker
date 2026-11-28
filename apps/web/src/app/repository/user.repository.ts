import { Injectable, inject } from '@angular/core';
import type { Avatar, UserSummary } from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class UserRepository {
	private readonly apiSdk = inject(ApiSdkService);

	/**
	 * Prefix search over the username, so the friends screen can tell a typo from a stranger.
	 * Never answers with yourself, and carries nothing but uuid, username and avatar.
	 */
	async search(username: string): Promise<readonly UserSummary[]> {
		return this.apiSdk.GET.user('', { query: { username } });
	}

	async updateAvatar(avatar: Avatar): Promise<Avatar> {
		return this.apiSdk.PATCH.user('/avatar', { params: avatar });
	}
}

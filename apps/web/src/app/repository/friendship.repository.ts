import { Injectable, inject } from '@angular/core';
import type {
	FriendRequests,
	FriendUser,
	Friendship,
	UserBlock,
} from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class FriendshipRepository {
	private readonly apiSdk = inject(ApiSdkService);

	/**
	 * Answers with the other person and not the `friendship` row, which is why undoing goes
	 * by the friend's uuid: the row's own never reaches the client.
	 */
	async listFriends(): Promise<readonly FriendUser[]> {
		return this.apiSdk.GET.friendship('');
	}

	async listRequests(): Promise<FriendRequests> {
		return this.apiSdk.GET.friendship('/request');
	}

	/**
	 * The API identifies the addressee by username, not by uuid, because that is what
	 * gets typed. Finding out whether it exists is `UserRepository.search()`.
	 */
	async sendRequest(username: string): Promise<Friendship> {
		return this.apiSdk.POST.friendship('/request', { params: { username } });
	}

	async accept(uuid: string): Promise<Friendship> {
		return this.apiSdk.PATCH.friendship('/:uuid/accept', { path: { uuid } });
	}

	async decline(uuid: string): Promise<Friendship> {
		return this.apiSdk.PATCH.friendship('/:uuid/decline', { path: { uuid } });
	}

	/** Cancels a request that has not been answered yet, by the uuid of the request. */
	async remove(uuid: string): Promise<void> {
		return this.apiSdk.DELETE.friendship('/:uuid', { path: { uuid } });
	}

	/**
	 * The same removal by the other person's uuid, which is the one the button can call. At
	 * most one live row exists per pair, so there is nothing to disambiguate.
	 */
	async removeByUser(userUuid: string): Promise<void> {
		return this.apiSdk.DELETE.friendship('/user/:uuid', { path: { uuid: userUuid } });
	}

	async listBlocked(): Promise<readonly UserBlock[]> {
		return this.apiSdk.GET.userBlock('');
	}

	async block(username: string): Promise<UserBlock> {
		return this.apiSdk.POST.userBlock('', { params: { username } });
	}

	async unblock(uuid: string): Promise<void> {
		return this.apiSdk.DELETE.userBlock('/:uuid', { path: { uuid } });
	}
}

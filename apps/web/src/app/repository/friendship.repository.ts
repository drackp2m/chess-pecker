import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '@app/definition/api.constant';
import {
	FriendRequests,
	FriendUser,
	Friendship,
	UserBlock,
} from '@app/definition/friendship.interface';

@Injectable({
	providedIn: 'root',
})
export class FriendshipRepository {
	private readonly httpClient = inject(HttpClient);
	private readonly baseUrl = `${API_BASE_URL}/friendship`;
	private readonly blockUrl = `${API_BASE_URL}/user-block`;

	/**
	 * Answers with the *other person*, not with the `friendship` row, which is what the
	 * screen paints. Undoing a friendship therefore goes by the friend's uuid — see
	 * `removeByUser()` — because the uuid of the row never reaches the client.
	 */
	async listFriends(): Promise<FriendUser[]> {
		return firstValueFrom(
			this.httpClient.get<FriendUser[]>(this.baseUrl, { withCredentials: true }),
		);
	}

	async listRequests(): Promise<FriendRequests> {
		return firstValueFrom(
			this.httpClient.get<FriendRequests>(`${this.baseUrl}/request`, { withCredentials: true }),
		);
	}

	/**
	 * The API identifies the addressee by username, not by uuid, because that is what
	 * gets typed. Finding out whether it exists is `UserRepository.search()`.
	 */
	async sendRequest(username: string): Promise<Friendship> {
		return firstValueFrom(
			this.httpClient.post<Friendship>(
				`${this.baseUrl}/request`,
				{ username },
				{ withCredentials: true },
			),
		);
	}

	async accept(uuid: string): Promise<Friendship> {
		return firstValueFrom(
			this.httpClient.patch<Friendship>(
				`${this.baseUrl}/${uuid}/accept`,
				{},
				{ withCredentials: true },
			),
		);
	}

	async decline(uuid: string): Promise<Friendship> {
		return firstValueFrom(
			this.httpClient.patch<Friendship>(
				`${this.baseUrl}/${uuid}/decline`,
				{},
				{ withCredentials: true },
			),
		);
	}

	/** Cancels a request that has not been answered yet, by the uuid of the request. */
	async remove(uuid: string): Promise<void> {
		await firstValueFrom(
			this.httpClient.delete(`${this.baseUrl}/${uuid}`, { withCredentials: true }),
		);
	}

	/**
	 * The same removal, by the uuid of the other person: the friends list is made of
	 * users, so this is the one the "unfriend" button can call. At most one live row
	 * exists between two people, so there is nothing to disambiguate.
	 */
	async removeByUser(userUuid: string): Promise<void> {
		await firstValueFrom(
			this.httpClient.delete(`${this.baseUrl}/user/${userUuid}`, { withCredentials: true }),
		);
	}

	async listBlocked(): Promise<UserBlock[]> {
		return firstValueFrom(
			this.httpClient.get<UserBlock[]>(this.blockUrl, { withCredentials: true }),
		);
	}

	async block(username: string): Promise<UserBlock> {
		return firstValueFrom(
			this.httpClient.post<UserBlock>(this.blockUrl, { username }, { withCredentials: true }),
		);
	}

	async unblock(uuid: string): Promise<void> {
		await firstValueFrom(
			this.httpClient.delete(`${this.blockUrl}/${uuid}`, { withCredentials: true }),
		);
	}
}

import { Injectable, inject } from '@angular/core';
import type { FriendUser } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { Resettable } from '@app/definition/resettable.interface';
import { FriendshipRepository } from '@app/repository/friendship.repository';
import { ApiCancelledError } from '@app/util/api-cancelled-error';

interface FriendStoreProps {
	friends: readonly FriendUser[];
	isLoaded: boolean;
	hasFailed: boolean;
}

const initialState: FriendStoreProps = {
	friends: [],
	isLoaded: false,
	hasFailed: false,
};

/**
 * The account's friends on their own, without the requests and blocks `ProfileStore` loads
 * beside them, so a list wanted from anywhere can be read before it is asked for. A refresh
 * keeps the last list on screen until the new one arrives.
 */
@Injectable({
	providedIn: 'root',
})
export class FriendStore
	extends signalStore({ protectedState: false }, withState(initialState))
	implements Resettable
{
	private readonly friendshipRepository = inject(FriendshipRepository);

	private inFlight: Promise<void> | null = null;
	private generation = 0;

	async ensureLoaded(): Promise<void> {
		if (this.isLoaded()) {
			return;
		}

		await this.refresh();
	}

	async refresh(): Promise<void> {
		this.inFlight ??= this.fetch().finally(() => {
			this.inFlight = null;
		});

		await this.inFlight;
	}

	replace(friends: readonly FriendUser[]): void {
		patchState(this, { friends, isLoaded: true, hasFailed: false });
	}

	reset(): void {
		this.generation++;
		this.inFlight = null;
		patchState(this, initialState);
	}

	private async fetch(): Promise<void> {
		const generation = this.generation;

		patchState(this, { hasFailed: false });

		try {
			const friends = await this.friendshipRepository.listFriends();

			// A reset in between means another account: its list must not land on this one.
			if (generation === this.generation) {
				this.replace(friends);
			}
		} catch (error: unknown) {
			// A navigation cancels the read, and a list that never arrived is not a failure:
			// the next time it is wanted it is simply asked for again.
			if (!ApiCancelledError.is(error) && generation === this.generation) {
				console.error('Could not load the friend list', error);
				patchState(this, { hasFailed: true });
			}
		}
	}
}

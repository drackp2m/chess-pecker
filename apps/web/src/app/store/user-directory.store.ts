import { Injectable, inject } from '@angular/core';
import { MAX_AVATAR_LOOKUP } from '@chesspecker/api-definitions';
import type { Avatar } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { Resettable } from '@app/definition/resettable.interface';
import { UserRepository } from '@app/repository/user.repository';
import { SessionStore } from '@app/store/session.store';
import { ApiCancelledError } from '@app/util/api-cancelled-error';

export interface KnownAvatar {
	readonly uuid: string;
	readonly avatar?: Avatar | null;
}

interface UserDirectoryStoreProps {
	avatars: Readonly<Record<string, Avatar | null>>;
}

const initialState: UserDirectoryStoreProps = {
	avatars: {},
};

@Injectable({
	providedIn: 'root',
})
export class UserDirectoryStore
	extends signalStore({ protectedState: false }, withState(initialState))
	implements Resettable
{
	private readonly userRepository = inject(UserRepository);
	private readonly session = inject(SessionStore);

	private readonly asked = new Set<string>();
	private queued = new Set<string>();
	private flushing: Promise<void> | null = null;

	avatarOf(uuid: string): Avatar | null | undefined {
		const user = this.session.user();

		if (null !== user && user.uuid === uuid) {
			return this.session.avatar();
		}

		return this.avatars()[uuid];
	}

	remember(users: readonly KnownAvatar[]): void {
		const known = users.filter((user) => undefined !== user.avatar);

		if (0 === known.length) {
			return;
		}

		const avatars = { ...this.avatars() };

		for (const user of known) {
			avatars[user.uuid] = user.avatar ?? null;
			this.asked.add(user.uuid);
		}

		patchState(this, { avatars });
	}

	request(uuid: string): void {
		if (
			!this.session.isAuthenticated() ||
			uuid === this.session.user()?.uuid ||
			this.asked.has(uuid) ||
			uuid in this.avatars()
		) {
			return;
		}

		this.asked.add(uuid);
		this.queued.add(uuid);
		this.flushing ??= Promise.resolve().then(async () => this.flush());
	}

	reset(): void {
		this.asked.clear();
		this.queued.clear();
		patchState(this, initialState);
	}

	private async flush(): Promise<void> {
		const uuids = [...this.queued];

		this.queued = new Set();
		this.flushing = null;

		for (let start = 0; start < uuids.length; start += MAX_AVATAR_LOOKUP) {
			await this.lookUp(uuids.slice(start, start + MAX_AVATAR_LOOKUP));
		}
	}

	private async lookUp(uuids: readonly string[]): Promise<void> {
		try {
			this.remember(await this.userRepository.avatars(uuids));
		} catch (error) {
			for (const uuid of uuids) {
				this.asked.delete(uuid);
			}

			if (!ApiCancelledError.is(error)) {
				console.error('Could not look the avatars up', error);
			}
		}
	}
}

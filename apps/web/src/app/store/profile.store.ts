import { Injectable, inject } from '@angular/core';
import type { FriendUser, Friendship, UserBlock, UserSummary } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import type { TranslationRef } from '@app/definition/i18n.type';
import { Resettable } from '@app/definition/resettable.interface';
import { I18n, i18nRef } from '@app/i18n';
import { FriendshipRepository } from '@app/repository/friendship.repository';
import { UserRepository } from '@app/repository/user.repository';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { HttpError } from '@app/util/http-error';

interface ProfileStoreProps {
	friends: readonly FriendUser[];
	received: readonly Friendship[];
	sent: readonly Friendship[];
	blocked: readonly UserBlock[];
	matches: readonly UserSummary[];
	/** The term `matches` answers to, so the list can be labelled and cleared. */
	searchTerm: string;
	isLoading: boolean;
	isSearching: boolean;
	isSubmitting: boolean;
	error: TranslationRef | null;
	notice: TranslationRef | null;
}

const initialState: ProfileStoreProps = {
	friends: [],
	received: [],
	sent: [],
	blocked: [],
	matches: [],
	searchTerm: '',
	isLoading: false,
	isSearching: false,
	isSubmitting: false,
	error: null,
	notice: null,
};

@Injectable({
	providedIn: 'root',
})
export class ProfileStore
	extends signalStore({ protectedState: false }, withState(initialState))
	implements Resettable
{
	private readonly friendshipRepository = inject(FriendshipRepository);
	private readonly userRepository = inject(UserRepository);

	reset(): void {
		patchState(this, initialState);
	}

	async load(): Promise<void> {
		patchState(this, { isLoading: true, error: null });

		try {
			const [friends, requests, blocked] = await Promise.all([
				this.friendshipRepository.listFriends(),
				this.friendshipRepository.listRequests(),
				this.friendshipRepository.listBlocked(),
			]);

			patchState(this, {
				friends,
				received: requests.received,
				sent: requests.sent,
				blocked,
				isLoading: false,
			});
		} catch (error) {
			patchState(this, {
				isLoading: false,
				...(ApiCancelledError.is(error)
					? {}
					: { error: HttpError.toRef(error, i18nRef(I18n.profile.LOAD_ERROR)) }),
			});
		}
	}

	/** Looks a username up by prefix, so a request goes to someone who exists. */
	async search(term: string): Promise<void> {
		const username = term.trim();

		if ('' === username) {
			patchState(this, { matches: [], searchTerm: '' });

			return;
		}

		patchState(this, { isSearching: true, error: null, notice: null });

		try {
			patchState(this, {
				matches: await this.userRepository.search(username),
				searchTerm: username,
				isSearching: false,
			});
		} catch (error) {
			// The term is dropped along with the results: a failed search is not an empty
			// one, and "nobody is called that" would be the wrong thing to read.
			patchState(this, {
				matches: [],
				searchTerm: '',
				isSearching: false,
				...(ApiCancelledError.is(error)
					? {}
					: { error: HttpError.toRef(error, i18nRef(I18n.profile.SEARCH_ERROR)) }),
			});
		}
	}

	clearSearch(): void {
		patchState(this, { matches: [], searchTerm: '' });
	}

	async sendRequest(username: string): Promise<boolean> {
		const sent = await this.mutate(
			async () => {
				await this.friendshipRepository.sendRequest(username);
			},
			i18nRef(I18n.profile.REQUEST_SENT_TO, { username }),
			i18nRef(I18n.profile.SEND_ERROR),
		);

		if (sent) {
			patchState(this, { matches: [], searchTerm: '' });
		}

		return sent;
	}

	async accept(uuid: string): Promise<boolean> {
		return this.mutate(
			async () => {
				await this.friendshipRepository.accept(uuid);
			},
			i18nRef(I18n.profile.REQUEST_ACCEPTED),
			i18nRef(I18n.profile.ACCEPT_ERROR),
		);
	}

	async decline(uuid: string): Promise<boolean> {
		return this.mutate(
			async () => {
				await this.friendshipRepository.decline(uuid);
			},
			i18nRef(I18n.profile.REQUEST_DECLINED),
			i18nRef(I18n.profile.DECLINE_ERROR),
		);
	}

	/** Cancels a request that is still waiting for an answer. */
	async remove(uuid: string): Promise<boolean> {
		return this.mutate(
			async () => {
				await this.friendshipRepository.remove(uuid);
			},
			i18nRef(I18n.profile.REMOVED),
			i18nRef(I18n.profile.REMOVE_ERROR),
		);
	}

	/** Undoes a friendship, which the API identifies by the other person. */
	async unfriend(user: FriendUser): Promise<boolean> {
		return this.mutate(
			async () => {
				await this.friendshipRepository.removeByUser(user.uuid);
			},
			i18nRef(I18n.profile.NO_LONGER_FRIEND, { username: user.username }),
			i18nRef(I18n.profile.UNFRIEND_ERROR),
		);
	}

	async block(username: string): Promise<boolean> {
		return this.mutate(
			async () => {
				await this.friendshipRepository.block(username);
			},
			i18nRef(I18n.profile.USER_BLOCKED, { username }),
			i18nRef(I18n.profile.BLOCK_ERROR),
		);
	}

	async unblock(uuid: string): Promise<boolean> {
		return this.mutate(
			async () => {
				await this.friendshipRepository.unblock(uuid);
			},
			i18nRef(I18n.profile.UNBLOCKED),
			i18nRef(I18n.profile.UNBLOCK_ERROR),
		);
	}

	clearFeedback(): void {
		patchState(this, { error: null, notice: null });
	}

	/**
	 * Every write is followed by a reload: the endpoints answer with the row they
	 * touched, but a friendship moving between lists changes three of them at once.
	 */
	private async mutate(
		action: () => Promise<void>,
		notice: TranslationRef,
		fallback: TranslationRef,
	): Promise<boolean> {
		patchState(this, { isSubmitting: true, error: null, notice: null });

		try {
			await action();
		} catch (error) {
			patchState(this, { isSubmitting: false, error: HttpError.toRef(error, fallback) });

			return false;
		}

		await this.load();
		patchState(this, { isSubmitting: false, notice });

		return true;
	}
}

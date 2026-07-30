import { Injectable, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { FriendUser, Friendship, UserBlock } from '@app/definition/friendship.interface';
import { UserSummary } from '@app/definition/user.interface';
import { FriendshipRepository } from '@app/repository/friendship.repository';
import { UserRepository } from '@app/repository/user.repository';
import { HttpError } from '@app/util/http-error';

interface FriendStoreProps {
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
	error: string | null;
	notice: string | null;
}

const initialState: FriendStoreProps = {
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
export class FriendStore extends signalStore({ protectedState: false }, withState(initialState)) {
	private readonly friendshipRepository = inject(FriendshipRepository);
	private readonly userRepository = inject(UserRepository);

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
				error: HttpError.toMessage(error, 'Could not load your friends.'),
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
				error: HttpError.toMessage(error, 'The search could not be run.'),
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
			`Request sent to ${username}.`,
			'The request could not be sent.',
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
			'Request accepted.',
			'The request could not be accepted.',
		);
	}

	async decline(uuid: string): Promise<boolean> {
		return this.mutate(
			async () => {
				await this.friendshipRepository.decline(uuid);
			},
			'Request declined.',
			'The request could not be declined.',
		);
	}

	/** Cancels a request that is still waiting for an answer. */
	async remove(uuid: string): Promise<boolean> {
		return this.mutate(
			async () => {
				await this.friendshipRepository.remove(uuid);
			},
			'Removed.',
			'It could not be removed.',
		);
	}

	/** Undoes a friendship, which the API identifies by the other person. */
	async unfriend(user: FriendUser): Promise<boolean> {
		return this.mutate(
			async () => {
				await this.friendshipRepository.removeByUser(user.uuid);
			},
			`${user.username} is no longer a friend.`,
			'The friendship could not be undone.',
		);
	}

	async block(username: string): Promise<boolean> {
		return this.mutate(
			async () => {
				await this.friendshipRepository.block(username);
			},
			`${username} is blocked.`,
			'The user could not be blocked.',
		);
	}

	async unblock(uuid: string): Promise<boolean> {
		return this.mutate(
			async () => {
				await this.friendshipRepository.unblock(uuid);
			},
			'Unblocked.',
			'The block could not be lifted.',
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
		notice: string,
		fallback: string,
	): Promise<boolean> {
		patchState(this, { isSubmitting: true, error: null, notice: null });

		try {
			await action();
		} catch (error) {
			patchState(this, { isSubmitting: false, error: HttpError.toMessage(error, fallback) });

			return false;
		}

		await this.load();
		patchState(this, { isSubmitting: false, notice });

		return true;
	}
}

import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import type { UserNotification } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import type { TranslationRef } from '@app/definition/i18n.type';
import { Resettable } from '@app/definition/resettable.interface';
import { I18n, i18nRef } from '@app/i18n';
import { NotificationRepository } from '@app/repository/notification.repository';
import { NotificationService } from '@app/service/notification.service';
import { SessionStore } from '@app/store/session.store';
import { ApiCancelledError } from '@app/util/api-cancelled-error';

/**
 * How often the account is asked what happened. A challenge is not a chat, so minutes are
 * the right unit: a socket would buy nothing but a connection to keep alive.
 */
const POLL_INTERVAL_MS = 2 * 60 * 1000;

/**
 * How many are announced in one go. A run of them arriving at once would bury the screen,
 * so the rest wait for the next poll instead of being swallowed.
 */
const ANNOUNCE_BATCH = 5;

interface NotificationStoreProps {
	notifications: readonly UserNotification[];
	isLoading: boolean;
}

const initialState: NotificationStoreProps = {
	notifications: [],
	isLoading: false,
};

/**
 * The account's inbox, polled while a session is open. Announcing one marks it read, so the
 * toast is not shown twice; the row stays on the server, which is where a screen listing
 * the history will read it from.
 */
@Injectable({
	providedIn: 'root',
})
export class NotificationStore
	extends signalStore({ protectedState: false }, withState(initialState))
	implements Resettable
{
	readonly unread = computed(() =>
		this.notifications().filter((notification) => null === notification.readAt),
	);

	private readonly repository = inject(NotificationRepository);
	private readonly notificationService = inject(NotificationService);
	private readonly sessionStore = inject(SessionStore);

	private ticker: ReturnType<typeof setInterval> | undefined;

	constructor() {
		super();

		this.watchSession();
		this.watchVisibility();
	}

	reset(): void {
		this.stopPolling();
		patchState(this, initialState);
	}

	async poll(): Promise<void> {
		if (!this.sessionStore.isAuthenticated() || this.isLoading()) {
			return;
		}

		patchState(this, { isLoading: true });

		try {
			const notifications = await this.repository.list();

			patchState(this, { notifications });
			await this.announce(notifications);
		} catch (error: unknown) {
			// Silent on purpose: a poll that could not go out is not something to interrupt
			// anybody with, and the next one is two minutes away.
			if (!ApiCancelledError.is(error)) {
				console.error('Could not read the notifications', error);
			}
		} finally {
			patchState(this, { isLoading: false });
		}
	}

	/**
	 * Polling belongs to the session: nothing goes out while nobody is signed in. Only the
	 * session is watched — the first poll runs inside `untracked`, or the effect would come
	 * to depend on the very flags that poll writes and fire itself forever.
	 */
	private watchSession(): void {
		effect(() => {
			const isAuthenticated = this.sessionStore.isAuthenticated();

			untracked(() => {
				if (isAuthenticated) {
					this.startPolling();
				} else {
					this.reset();
				}
			});
		});
	}

	/**
	 * A backgrounded tab keeps its timer but is throttled to a crawl, so coming back is
	 * worth a poll of its own rather than waiting out whatever is left of the interval.
	 */
	private watchVisibility(): void {
		document.addEventListener('visibilitychange', () => {
			if ('visible' === document.visibilityState) {
				void this.poll();
			}
		});
	}

	private startPolling(): void {
		if (undefined !== this.ticker) {
			return;
		}

		this.ticker = setInterval(() => {
			void this.poll();
		}, POLL_INTERVAL_MS);

		void this.poll();
	}

	private stopPolling(): void {
		if (undefined === this.ticker) {
			return;
		}

		clearInterval(this.ticker);
		this.ticker = undefined;
	}

	/** Oldest first, so the newest is the one left on screen when they pile up. */
	private async announce(notifications: readonly UserNotification[]): Promise<void> {
		const fresh = notifications
			.filter((notification) => null === notification.readAt)
			.slice(0, ANNOUNCE_BATCH)
			.reverse();

		if (0 === fresh.length) {
			return;
		}

		for (const notification of fresh) {
			this.notificationService.notify(describeNotification(notification));
		}

		try {
			await this.repository.markRead(fresh.map((notification) => notification.uuid));
		} catch (error: unknown) {
			console.error('Could not mark the notifications as read', error);
		}
	}
}

function describeNotification(notification: UserNotification): TranslationRef {
	const username = notification.actor?.username ?? '';

	switch (notification.type) {
		case 'puzzle-share-received':
			return i18nRef(I18n.common.SHARE_CHALLENGE_RECEIVED, { username });
		case 'puzzle-share-solved':
			return i18nRef(I18n.common.SHARE_CHALLENGE_SOLVED, { username });
	}
}

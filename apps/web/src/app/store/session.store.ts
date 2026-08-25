import { HttpStatusCode } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import type { AuthUser, LoginRequest, RegisterRequest } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import type { TranslationRef } from '@app/definition/i18n.type';
import { ConnectionPhase, SessionStatus } from '@app/definition/session-status.type';
import { I18n, i18nRef } from '@app/i18n';
import { AuthRepository } from '@app/repository/auth.repository';
import { ConnectionStore } from '@app/store/connection.store';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { HttpError } from '@app/util/http-error';

/**
 * How long an answer stays good enough to skip asking again. Kept under the quarter hour
 * Render waits before sleeping, so a revalidation also keeps the service awake.
 */
const STALE_AFTER_MS = 10 * 60 * 1000;

interface SessionStoreProps {
	status: SessionStatus;
	user: AuthUser | null;
	isSubmitting: boolean;
	error: TranslationRef | null;
}

const initialState: SessionStoreProps = {
	status: 'unknown',
	user: null,
	isSubmitting: false,
	error: null,
};

@Injectable({
	providedIn: 'root',
})
export class SessionStore extends signalStore({ protectedState: false }, withState(initialState)) {
	readonly isAuthenticated = computed(() => 'authenticated' === this.status());
	readonly isAnonymous = computed(() => 'anonymous' === this.status());
	readonly isUnreachable = computed(() => 'unreachable' === this.status());
	readonly username = computed(() => this.user()?.username ?? null);

	/**
	 * Two readings of the same probe that must not contradict each other on screen: the
	 * session that never resolved, and what the trip said about the server meanwhile.
	 */
	readonly connectionPhase = computed<ConnectionPhase>(() =>
		this.isUnreachable() ? 'unreachable' : this.connectionStore.phase(),
	);

	private readonly authRepository = inject(AuthRepository);
	private readonly connectionStore = inject(ConnectionStore);
	private refreshing: Promise<void> | null = null;
	private probing: Promise<void> | null = null;
	private checkedAt = 0;

	// Called from the app initializer rather than a constructor, so injecting the store
	// never kicks off an HTTP request.
	async restore(): Promise<void> {
		// Cleared here and not in `probe()`: a call that fails without suspending would settle
		// before the assignment, leaving a promise every later restore would wait on.
		this.probing ??= this.probe().finally(() => {
			this.probing = null;
		});

		return this.probing;
	}

	/**
	 * A tab left open for hours would believe its boot answer forever while the session
	 * expires. Coming back is the moment to ask again, if the last answer is old enough.
	 */
	watch(): void {
		document.addEventListener('visibilitychange', () => {
			if ('visible' === document.visibilityState) {
				void this.revalidate();
			}
		});

		window.addEventListener('online', () => {
			void this.revalidate();
		});
	}

	async revalidate(): Promise<void> {
		if (Date.now() - this.checkedAt < STALE_AFTER_MS) {
			return;
		}

		return this.restore();
	}

	/**
	 * The way out of `unreachable`. A restore already in flight is left alone: asking twice
	 * would only spend another cold start.
	 */
	async retry(): Promise<void> {
		if ('unknown' === this.status()) {
			return;
		}

		patchState(this, { status: 'unknown' });

		return this.restore();
	}

	async logIn(
		request: LoginRequest,
		beforeAdopting?: (user: AuthUser) => Promise<void>,
	): Promise<boolean> {
		patchState(this, { isSubmitting: true, error: null });

		try {
			await this.authRepository.logIn(request);

			const user = await this.authRepository.getCurrentUser();
			await beforeAdopting?.(user);

			patchState(this, {
				status: 'authenticated',
				user,
				isSubmitting: false,
			});
			this.checkedAt = Date.now();

			return true;
		} catch (error) {
			patchState(this, { isSubmitting: false, error: SessionStore.logInError(error) });

			return false;
		}
	}

	async register(
		request: RegisterRequest,
		beforeAdopting?: (user: AuthUser) => Promise<void>,
	): Promise<boolean> {
		patchState(this, { isSubmitting: true, error: null });

		try {
			await this.authRepository.register(request);
		} catch (error) {
			patchState(this, {
				isSubmitting: false,
				error: HttpError.toRef(error, i18nRef(I18n.common.REGISTER_FAILED)),
			});

			return false;
		}

		return this.logIn({ username: request.username, password: request.password }, beforeAdopting);
	}

	/**
	 * Only the API can close a session in `httpOnly` cookies, so a failed call stays visible
	 * rather than lying about it. Wiping the device is `LogOutUseCase`'s job.
	 */
	async logOut(): Promise<boolean> {
		patchState(this, { isSubmitting: true, error: null });

		try {
			await this.authRepository.logOut();
		} catch (error) {
			patchState(this, {
				isSubmitting: false,
				error: HttpError.toRef(error, i18nRef(I18n.common.LOG_OUT_FAILED)),
			});

			return false;
		}

		patchState(this, { status: 'anonymous', user: null, isSubmitting: false, error: null });
		this.checkedAt = Date.now();

		return true;
	}

	/**
	 * Renewing is shared on purpose: the API rotates the refresh cookie, so two racing calls
	 * would spend the same token twice and the loser would close the renewed session.
	 */
	async refresh(): Promise<void> {
		this.refreshing ??= this.renewSession();

		return this.refreshing;
	}

	/** The renewal in flight, if there is one, so a request that starts mid-refresh can wait. */
	pendingRefresh(): Promise<void> | null {
		return this.refreshing;
	}

	/** The API refused to renew: only the cookies decide, so the store follows them. */
	expire(): void {
		patchState(this, { status: 'anonymous', user: null });
	}

	clearError(): void {
		patchState(this, { error: null });
	}

	/**
	 * A 401 here really means "no session": `authInterceptor` already renewed and repeated the
	 * call. Anything else says nothing about it, so it must not read as `anonymous`.
	 */
	private static toFailedStatus(error: unknown): SessionStatus {
		return HttpError.hasStatus(error, HttpStatusCode.Unauthorized) ||
			HttpError.hasStatus(error, HttpStatusCode.Forbidden)
			? 'anonymous'
			: 'unreachable';
	}

	private static logInError(error: unknown): TranslationRef {
		if (HttpError.hasStatus(error, HttpStatusCode.Unauthorized)) {
			return i18nRef(I18n.common.WRONG_CREDENTIALS);
		}

		if (HttpError.hasStatus(error, HttpStatusCode.NotFound)) {
			return i18nRef(I18n.common.NO_SUCH_ACCOUNT);
		}

		return HttpError.toRef(error, i18nRef(I18n.common.LOG_IN_FAILED));
	}

	/**
	 * Shared like the renewal above, since a cold start is expensive. A cancelled call leaves
	 * the status and the clock alone, so the next chance to ask still asks.
	 */
	private async probe(): Promise<void> {
		try {
			const user = await this.connectionStore.track(this.authRepository.getCurrentUser());

			patchState(this, { status: 'authenticated', user });
			this.checkedAt = Date.now();
		} catch (error) {
			if (ApiCancelledError.is(error)) {
				return;
			}

			patchState(this, { status: SessionStore.toFailedStatus(error), user: null });
			this.checkedAt = Date.now();
		}
	}

	private async renewSession(): Promise<void> {
		try {
			await this.authRepository.refreshSession();
		} finally {
			this.refreshing = null;
		}
	}
}

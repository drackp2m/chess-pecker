import { HttpStatusCode } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import type { AuthUser, LoginRequest, RegisterRequest } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { ConnectionPhase, SessionStatus } from '@app/definition/session-status.type';
import { AuthRepository } from '@app/repository/auth.repository';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { HttpError } from '@app/util/http-error';

/** How long the wait is allowed to look normal, and when it starts looking like a cold start. */
const CONNECTING_AFTER_MS = 2000;
const WAKING_AFTER_MS = 10000;

interface SessionStoreProps {
	status: SessionStatus;
	user: AuthUser | null;
	waiting: Exclude<ConnectionPhase, 'unreachable'>;
	isSubmitting: boolean;
	error: string | null;
}

const initialState: SessionStoreProps = {
	status: 'unknown',
	user: null,
	waiting: 'idle',
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
	 * The one thing the interface can show while the session settles. A failed call wins
	 * over the timers: once the API has answered badly there is nothing left to wait for.
	 */
	readonly connectionPhase = computed<ConnectionPhase>(() =>
		'unreachable' === this.status() ? 'unreachable' : this.waiting(),
	);

	private readonly authRepository = inject(AuthRepository);
	private refreshing: Promise<void> | null = null;
	private waitTimers: ReturnType<typeof setTimeout>[] = [];

	// Called once from the app initializer (see app.config.ts) rather than from a
	// constructor, so nothing that injects the store kicks off an HTTP request. A 401 is
	// not the end of it either: `authInterceptor` renews the session and repeats the call
	// before anything reaches this `catch`, which therefore does mean "there is no session".
	async restore(): Promise<void> {
		this.startWaiting();

		try {
			const user = await this.authRepository.getCurrentUser();

			patchState(this, { status: 'authenticated', user });
		} catch (error) {
			if (ApiCancelledError.is(error)) {
				return;
			}

			patchState(this, { status: SessionStore.toFailedStatus(error), user: null });
		} finally {
			this.stopWaiting();
		}
	}

	/**
	 * The way out of `unreachable`: the server was asleep and someone is saying it may be
	 * awake now. A restore already in flight is left alone — asking twice would only spend
	 * another cold start.
	 */
	async retry(): Promise<void> {
		if ('unknown' === this.status()) {
			return;
		}

		patchState(this, { status: 'unknown' });

		return this.restore();
	}

	async logIn(request: LoginRequest): Promise<boolean> {
		patchState(this, { isSubmitting: true, error: null });

		try {
			await this.authRepository.logIn(request);

			patchState(this, {
				status: 'authenticated',
				user: await this.authRepository.getCurrentUser(),
				isSubmitting: false,
			});

			return true;
		} catch (error) {
			patchState(this, { isSubmitting: false, error: SessionStore.logInError(error) });

			return false;
		}
	}

	async register(request: RegisterRequest): Promise<boolean> {
		patchState(this, { isSubmitting: true, error: null });

		try {
			await this.authRepository.register(request);
		} catch (error) {
			patchState(this, {
				isSubmitting: false,
				error: HttpError.toMessage(error, 'The account could not be created. Try again.'),
			});

			return false;
		}

		return this.logIn({ username: request.username, password: request.password });
	}

	/**
	 * La sesión vive en cookies `httpOnly`, así que sólo el API puede cerrarla: si la
	 * llamada falla no hay nada que el cliente pueda borrar por su cuenta. Pasar a
	 * `anonymous` de todos modos dejaba una interfaz mintiendo, con la sesión intacta
	 * esperando al siguiente refresco, así que el fallo se queda a la vista.
	 */
	async logOut(): Promise<boolean> {
		patchState(this, { isSubmitting: true, error: null });

		try {
			await this.authRepository.logOut();
		} catch (error) {
			patchState(this, {
				isSubmitting: false,
				error: HttpError.toMessage(error, 'Could not log out. Try again.'),
			});

			return false;
		}

		patchState(this, { status: 'anonymous', user: null, isSubmitting: false, error: null });

		return true;
	}

	/**
	 * Renewing is shared on purpose. The API rotates the refresh cookie, so two calls racing
	 * each other would spend the same token twice and the loser would close the session the
	 * winner had just renewed. Everything that fails at the same instant waits on the same
	 * round trip — `authInterceptor` is the only caller, and it has no way to coordinate.
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
	 * A 401 here is the end of the conversation, not the start of one: `authInterceptor`
	 * has already renewed and repeated the call before anything reaches this point, so it
	 * does mean "there is no session". Anything else — no network, a 5xx, a gateway that
	 * gave up on a cold start — says nothing about the session, and calling it `anonymous`
	 * would log the user out of an interface that has no idea whether they are logged in.
	 */
	private static toFailedStatus(error: unknown): SessionStatus {
		return HttpError.hasStatus(error, HttpStatusCode.Unauthorized) ||
			HttpError.hasStatus(error, HttpStatusCode.Forbidden)
			? 'anonymous'
			: 'unreachable';
	}

	private static logInError(error: unknown): string {
		if (HttpError.hasStatus(error, HttpStatusCode.Unauthorized)) {
			return 'Wrong username or password.';
		}

		if (HttpError.hasStatus(error, HttpStatusCode.NotFound)) {
			return 'There is no account with that username.';
		}

		return HttpError.toMessage(error, 'Could not log in. Try again.');
	}

	/**
	 * Two timers rather than a ticking interval: the phases only change twice, and a clock
	 * running for the whole visit to report a call that lasted two seconds is waste.
	 */
	private startWaiting(): void {
		this.stopWaiting();
		patchState(this, { waiting: 'idle' });

		this.waitTimers = [
			setTimeout(() => {
				patchState(this, { waiting: 'connecting' });
			}, CONNECTING_AFTER_MS),
			setTimeout(() => {
				patchState(this, { waiting: 'waking' });
			}, WAKING_AFTER_MS),
		];
	}

	private stopWaiting(): void {
		for (const timer of this.waitTimers) {
			clearTimeout(timer);
		}

		this.waitTimers = [];
		patchState(this, { waiting: 'idle' });
	}

	private async renewSession(): Promise<void> {
		try {
			await this.authRepository.refreshSession();
		} finally {
			this.refreshing = null;
		}
	}
}

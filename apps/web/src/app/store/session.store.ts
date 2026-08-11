import { HttpStatusCode } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import type { AuthUser, LoginRequest, RegisterRequest } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import type { TranslationRef } from '@app/definition/i18n.type';
import { SessionStatus } from '@app/definition/session-status.type';
import { I18n, i18nRef } from '@app/i18n';
import { AuthRepository } from '@app/repository/auth.repository';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { HttpError } from '@app/util/http-error';

/**
 * How long an answer stays good enough to skip asking again when the app comes back. Kept
 * under the quarter of an hour of silence Render waits before putting the service to
 * sleep, so a revalidation that finds the server awake is also what keeps it that way.
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

	private readonly authRepository = inject(AuthRepository);
	private refreshing: Promise<void> | null = null;
	private probing: Promise<void> | null = null;
	private checkedAt = 0;

	// Called once from the app initializer (see app.config.ts) rather than from a
	// constructor, so nothing that injects the store kicks off an HTTP request. A 401 is
	// not the end of it either: `authInterceptor` renews the session and repeats the call
	// before anything reaches this `catch`, which therefore does mean "there is no session".
	// The clearing lives here and not inside `probe()`: a call that fails without ever
	// suspending would finish before the assignment below, leaving a settled promise in
	// place that every later restore would wait on instead of asking again.
	async restore(): Promise<void> {
		this.probing ??= this.probe().finally(() => {
			this.probing = null;
		});

		return this.probing;
	}

	/**
	 * A tab left open for hours boots its answer once and then believes it forever, while
	 * the server behind it goes back to sleep and the session expires. Coming back to the
	 * app, or getting the network back, is the moment to ask again — but only if the last
	 * answer is old enough to be worth a round trip.
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
			this.checkedAt = Date.now();

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
				error: HttpError.toRef(error, i18nRef(I18n.common.REGISTER_FAILED)),
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
	 *
	 * Aquí sólo se cierra la sesión. Vaciar lo que el usuario dejó en el dispositivo es
	 * de `LogOutUseCase`, que es por donde entra la interfaz.
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
	 * Shared like the renewal above: a revalidation, a retry and the boot probe can all
	 * land at once, and a cold start is expensive enough that they had better wait on the
	 * same round trip. A cancelled call leaves the status untouched and the clock alone,
	 * so the next chance to ask still asks.
	 */
	private async probe(): Promise<void> {
		try {
			const user = await this.authRepository.getCurrentUser();

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

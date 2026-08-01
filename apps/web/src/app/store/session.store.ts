import { HttpStatusCode } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { AuthUser, LoginRequest, RegisterRequest } from '@app/definition/auth.interface';
import { SessionStatus } from '@app/definition/session-status.type';
import { AuthRepository } from '@app/repository/auth.repository';
import { HttpError } from '@app/util/http-error';

interface SessionStoreProps {
	status: SessionStatus;
	user: AuthUser | null;
	isSubmitting: boolean;
	error: string | null;
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
	readonly username = computed(() => this.user()?.username ?? null);

	private readonly authRepository = inject(AuthRepository);
	private refreshing: Promise<void> | null = null;

	// Called once from the app initializer (see app.config.ts) rather than from a
	// constructor, so nothing that injects the store kicks off an HTTP request. A 401 is
	// not the end of it either: `authInterceptor` renews the session and repeats the call
	// before anything reaches this `catch`, which therefore does mean "there is no session".
	async restore(): Promise<void> {
		try {
			const user = await this.authRepository.getCurrentUser();

			patchState(this, { status: 'authenticated', user });
		} catch {
			patchState(this, { status: 'anonymous', user: null });
		}
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

	private static logInError(error: unknown): string {
		if (HttpError.hasStatus(error, HttpStatusCode.Unauthorized)) {
			return 'Wrong username or password.';
		}

		if (HttpError.hasStatus(error, HttpStatusCode.NotFound)) {
			return 'There is no account with that username.';
		}

		return HttpError.toMessage(error, 'Could not log in. Try again.');
	}

	private async renewSession(): Promise<void> {
		try {
			await this.authRepository.refreshSession();
		} finally {
			this.refreshing = null;
		}
	}
}

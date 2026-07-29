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

	// Called once from the app initializer (see app.config.ts) rather than from a
	// constructor, so nothing that injects the store kicks off an HTTP request.
	async restore(): Promise<void> {
		try {
			patchState(this, { status: 'authenticated', user: await this.loadCurrentUser() });
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

	async logOut(): Promise<void> {
		await this.authRepository.logOut().catch(() => undefined);

		patchState(this, { status: 'anonymous', user: null, error: null });
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

	/**
	 * The access cookie expires long before the refresh one, so a reload after a while
	 * finds a session that is still valid but cannot be read yet. Only that case is worth
	 * a second round trip: the refresh cookie is scoped to `/auth/refresh-session`, so
	 * `/auth/me` cannot renew itself and answers 401 until it is asked again.
	 */
	private async loadCurrentUser(): Promise<AuthUser> {
		try {
			return await this.authRepository.getCurrentUser();
		} catch (error) {
			if (!HttpError.hasStatus(error, HttpStatusCode.Unauthorized)) {
				throw error;
			}

			await this.authRepository.refreshSession();

			return this.authRepository.getCurrentUser();
		}
	}
}

import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { AuthUser } from '@chesspecker/api-definitions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18n } from '@app/i18n';
import { AuthRepository } from '@app/repository/auth.repository';
import { SessionStore } from '@app/store/session.store';
import { provideTestingI18n } from '@app/testing/i18n.harness';

interface AuthRepositoryStub {
	register: (...args: unknown[]) => Promise<AuthUser>;
	logIn: (...args: unknown[]) => Promise<void>;
	logOut: (...args: unknown[]) => Promise<void>;
	refreshSession: (...args: unknown[]) => Promise<void>;
	getCurrentUser: (...args: unknown[]) => Promise<AuthUser>;
}

const credentials = { username: 'pecker', password: 'secret42' };

const authUser: AuthUser = { uuid: 'uuid', username: 'pecker', role: 'registered' };

// `HttpErrorResponse` implements `Error` without extending it, so a stub throws it
// instead of handing it to `Promise.reject`, which only takes real errors. Every
// caller awaits inside a `try`, so a thrown response is caught the same way.
function rejectsWith(status: number, error: unknown): () => never {
	return () => {
		throw new HttpErrorResponse({ status, error });
	};
}

function createRepository(overrides: Partial<AuthRepositoryStub> = {}): AuthRepositoryStub {
	return {
		register: vi.fn(() => Promise.resolve(authUser)),
		logIn: vi.fn(() => Promise.resolve()),
		logOut: vi.fn(() => Promise.resolve()),
		refreshSession: vi.fn(rejectsWith(401, { message: { refreshToken: 'invalid' } })),
		getCurrentUser: vi.fn(() => Promise.resolve(authUser)),
		...overrides,
	};
}

function injectStore(repository: AuthRepositoryStub): SessionStore {
	TestBed.configureTestingModule({
		providers: [
			provideTestingI18n(),
			SessionStore,
			{ provide: AuthRepository, useValue: repository },
		],
	});

	return TestBed.inject(SessionStore);
}

async function createStore(repository: AuthRepositoryStub): Promise<SessionStore> {
	const store = injectStore(repository);

	await store.restore();

	return store;
}

describe('SessionStore', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('opens as authenticated with whoever the cookies belong to', async () => {
		const store = await createStore(createRepository());

		expect(store.isAuthenticated()).toBe(true);
		expect(store.username()).toBe('pecker');
	});

	// Renewing the access cookie lives in `authInterceptor` now, and it fires one refresh
	// per request that failed. Rotating tokens make the second one close the session, so
	// what the store owes it is a single round trip shared by everything that raced.
	it('shares one refresh between everything that failed at the same instant', async () => {
		const refreshSession = vi.fn(() => Promise.resolve());
		const store = await createStore(createRepository({ refreshSession }));

		await Promise.all([store.refresh(), store.refresh(), store.refresh()]);

		expect(refreshSession).toHaveBeenCalledTimes(1);
	});

	it('renews again once the shared refresh has settled', async () => {
		const refreshSession = vi.fn(() => Promise.resolve());
		const store = await createStore(createRepository({ refreshSession }));

		await store.refresh();
		await store.refresh();

		expect(refreshSession).toHaveBeenCalledTimes(2);
	});

	it('drops the session when the API refuses to renew it', async () => {
		const store = await createStore(createRepository());

		await store.logIn(credentials);
		store.expire();

		expect(store.isAnonymous()).toBe(true);
		expect(store.username()).toBeNull();
	});

	it('falls back to anonymous when there is no session to restore', async () => {
		const store = await createStore(
			createRepository({
				getCurrentUser: vi.fn(rejectsWith(401, { message: { jwt: 'invalid' } })),
			}),
		);

		expect(store.isAnonymous()).toBe(true);
	});

	// The distinction the whole connection state rests on: a 401 is an answer, no network
	// is the absence of one. Reading the second as `anonymous` logs out a user whose
	// session may well be open, and sends them to a login page the same dead server would
	// have to accept.
	it('separates a server that does not answer from a session that does not exist', async () => {
		const store = await createStore(
			createRepository({ getCurrentUser: vi.fn(rejectsWith(0, null)) }),
		);

		expect(store.isUnreachable()).toBe(true);
		expect(store.isAnonymous()).toBe(false);
	});

	it('treats a gateway that gave up on a cold start as unreachable', async () => {
		const store = await createStore(
			createRepository({ getCurrentUser: vi.fn(rejectsWith(502, null)) }),
		);

		expect(store.isUnreachable()).toBe(true);
	});

	it('picks the session up when a retry finds the server awake', async () => {
		let isAwake = false;
		const getCurrentUser = vi.fn(() => {
			if (!isAwake) {
				throw new HttpErrorResponse({ status: 0, error: null });
			}

			return Promise.resolve(authUser);
		});

		const store = await createStore(createRepository({ getCurrentUser }));

		expect(store.isUnreachable()).toBe(true);

		isAwake = true;
		await store.retry();

		expect(store.isAuthenticated()).toBe(true);
	});

	// A cold start is 30–50 seconds of a call that has not failed yet, so a retry during
	// it would only queue a second one behind the same wait.
	it('ignores a retry while the first call is still out', async () => {
		const getCurrentUser = vi.fn(() => new Promise<AuthUser>(() => undefined));
		const store = injectStore(createRepository({ getCurrentUser }));

		void store.restore();
		await store.retry();

		expect(getCurrentUser).toHaveBeenCalledTimes(1);
	});

	it('keeps a fresh answer instead of asking again when the app comes back', async () => {
		const repository = createRepository();
		const store = await createStore(repository);

		await store.revalidate();

		expect(repository.getCurrentUser).toHaveBeenCalledTimes(1);
	});

	// The case the whole revalidation exists for: a tab left open long enough for the
	// server to fall asleep and the session to expire behind it.
	it('asks again when the answer it has is old', async () => {
		vi.useFakeTimers();

		const repository = createRepository();
		const store = await createStore(repository);

		vi.setSystemTime(Date.now() + 10 * 60 * 1000);
		await store.revalidate();

		expect(repository.getCurrentUser).toHaveBeenCalledTimes(2);

		vi.useRealTimers();
	});

	it('shares one round trip between everything that asks at once', async () => {
		const getCurrentUser = vi.fn(() => Promise.resolve(authUser));
		const store = injectStore(createRepository({ getCurrentUser }));

		await Promise.all([store.restore(), store.restore(), store.restore()]);

		expect(getCurrentUser).toHaveBeenCalledTimes(1);
	});

	it('keeps the username of whoever logs in', async () => {
		const store = await createStore(createRepository());

		const succeeded = await store.logIn(credentials);

		expect(succeeded).toBe(true);
		expect(store.isAuthenticated()).toBe(true);
		expect(store.username()).toBe('pecker');
	});

	it('turns a rejected login into a readable error', async () => {
		// No session to restore either: this is the login page of an anonymous visitor.
		const store = await createStore(
			createRepository({
				getCurrentUser: vi.fn(rejectsWith(401, { message: { jwt: 'invalid' } })),
				logIn: vi.fn(rejectsWith(401, { message: { password: 'not match' } })),
			}),
		);

		const succeeded = await store.logIn(credentials);

		expect(succeeded).toBe(false);
		expect(store.isAuthenticated()).toBe(false);
		expect(store.error()).toEqual({ key: I18n.common.WRONG_CREDENTIALS });
	});

	it('logs in with the credentials it just registered', async () => {
		const logIn = vi.fn(() => Promise.resolve());
		const store = await createStore(createRepository({ logIn }));

		const succeeded = await store.register(credentials);

		expect(succeeded).toBe(true);
		expect(logIn).toHaveBeenCalledWith(credentials);
		expect(store.isAuthenticated()).toBe(true);
	});

	it('reports the field the API complains about when registering', async () => {
		const store = await createStore(
			createRepository({
				register: vi.fn(rejectsWith(412, { message: { username: 'already exists' } })),
			}),
		);

		const succeeded = await store.register(credentials);

		expect(succeeded).toBe(false);
		expect(store.error()).toEqual({
			key: I18n.common.SERVER_DETAIL,
			params: { detail: 'username already exists.' },
		});
	});

	it('drops the session on log out', async () => {
		const store = await createStore(createRepository());

		await store.logIn(credentials);

		expect(await store.logOut()).toBe(true);
		expect(store.isAnonymous()).toBe(true);
		expect(store.username()).toBeNull();
	});

	// Las cookies son `httpOnly`: si el API no las caduca, la sesión sigue abierta y
	// pasar a `anonymous` sólo escondería que el logout no ha hecho nada.
	it('keeps the session when the API cannot close it', async () => {
		const store = await createStore(createRepository({ logOut: vi.fn(rejectsWith(500, null)) }));

		await store.logIn(credentials);

		expect(await store.logOut()).toBe(false);
		expect(store.isAuthenticated()).toBe(true);
		expect(store.error()).toEqual({ key: I18n.common.LOG_OUT_FAILED });
	});
});

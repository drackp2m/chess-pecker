import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthUser } from '@app/definition/auth.interface';
import { AuthRepository } from '@app/repository/auth.repository';
import { SessionStore } from '@app/store/session.store';

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

async function createStore(repository: AuthRepositoryStub): Promise<SessionStore> {
	TestBed.configureTestingModule({
		providers: [SessionStore, { provide: AuthRepository, useValue: repository }],
	});

	const store = TestBed.inject(SessionStore);

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
		expect(store.error()).toBe('Wrong username or password.');
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
		expect(store.error()).toBe('username already exists.');
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
		expect(store.error()).toBe('Could not log out. Try again.');
	});
});

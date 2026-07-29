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

	it('refreshes once and asks again when the access cookie has expired', async () => {
		let asked = 0;
		const refreshSession = vi.fn(() => Promise.resolve());
		const getCurrentUser = vi.fn(() => {
			asked += 1;

			if (1 === asked) {
				throw new HttpErrorResponse({ status: 401, error: { message: { jwt: 'invalid' } } });
			}

			return Promise.resolve(authUser);
		});

		const store = await createStore(createRepository({ refreshSession, getCurrentUser }));

		expect(refreshSession).toHaveBeenCalledTimes(1);
		expect(store.isAuthenticated()).toBe(true);
	});

	it('falls back to anonymous when the refresh is rejected too', async () => {
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
		await store.logOut();

		expect(store.isAnonymous()).toBe(true);
		expect(store.username()).toBeNull();
	});
});

import {
	HttpClient,
	HttpErrorResponse,
	provideHttpClient,
	withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { patchState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_BASE_URL } from '@app/definition/api.constant';
import { authInterceptor } from '@app/interceptor/auth.interceptor';
import { SessionStore } from '@app/store/session.store';

const TRAINING_URL = `${API_BASE_URL}/training`;
const FRIENDSHIP_URL = `${API_BASE_URL}/friendship`;
const REFRESH_URL = `${API_BASE_URL}/auth/refresh-session`;
const LOGIN_URL = `${API_BASE_URL}/auth/login`;

const expired = { status: 401, statusText: 'Unauthorized' };

interface RouterStub {
	navigate: (commands: string[]) => Promise<boolean>;
}

interface Harness {
	httpClient: HttpClient;
	httpMock: HttpTestingController;
	sessionStore: SessionStore;
	router: RouterStub;
}

// The real store and the real repository: what is under test is how the three of them
// behave when several requests race, which a stubbed renewal would decide for them.
function setUp(): Harness {
	const router: RouterStub = { navigate: vi.fn(() => Promise.resolve(true)) };

	TestBed.configureTestingModule({
		providers: [
			provideHttpClient(withInterceptors([authInterceptor])),
			provideHttpClientTesting(),
			{ provide: Router, useValue: router },
		],
	});

	return {
		httpClient: TestBed.inject(HttpClient),
		httpMock: TestBed.inject(HttpTestingController),
		sessionStore: TestBed.inject(SessionStore),
		router,
	};
}

// Every hand-off rides on a promise, so the requests that follow one are queued a few
// microtasks later. One macrotask drains all of them.
function settle(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, 0);
	});
}

describe('authInterceptor', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('carries the session cookies on every call to the API', async () => {
		const { httpClient, httpMock } = setUp();
		const response = firstValueFrom(httpClient.get(TRAINING_URL));
		const request = httpMock.expectOne(TRAINING_URL);

		expect(request.request.withCredentials).toBe(true);

		request.flush([]);

		await response;
	});

	it('renews the session and repeats the request when the access cookie expired', async () => {
		const { httpClient, httpMock } = setUp();
		const response = firstValueFrom(httpClient.get(TRAINING_URL));

		httpMock.expectOne(TRAINING_URL).flush(null, expired);

		await settle();

		httpMock.expectOne(REFRESH_URL).flush(null);

		await settle();

		httpMock.expectOne(TRAINING_URL).flush({ uuid: 'training' });

		expect(await response).toEqual({ uuid: 'training' });
	});

	// `expectOne` is the assertion here: a second renewal in flight would make it throw.
	it('renews once when several requests fail at the same instant', async () => {
		const { httpClient, httpMock } = setUp();
		const training = firstValueFrom(httpClient.get(TRAINING_URL));
		const friendship = firstValueFrom(httpClient.get(FRIENDSHIP_URL));

		httpMock.expectOne(TRAINING_URL).flush(null, expired);
		httpMock.expectOne(FRIENDSHIP_URL).flush(null, expired);

		await settle();

		httpMock.expectOne(REFRESH_URL).flush(null);

		await settle();

		httpMock.expectOne(TRAINING_URL).flush({ uuid: 'training' });
		httpMock.expectOne(FRIENDSHIP_URL).flush([{ uuid: 'friend' }]);

		expect(await training).toEqual({ uuid: 'training' });
		expect(await friendship).toEqual([{ uuid: 'friend' }]);
	});

	// Whatever starts once the cookie is known to be expired would only collect a 401 of
	// its own, so it waits for the new one instead of asking for a second renewal.
	it('holds back the requests that start while the session is being renewed', async () => {
		const { httpClient, httpMock } = setUp();
		const training = firstValueFrom(httpClient.get(TRAINING_URL));

		httpMock.expectOne(TRAINING_URL).flush(null, expired);

		await settle();

		const renewal = httpMock.expectOne(REFRESH_URL);
		const friendship = firstValueFrom(httpClient.get(FRIENDSHIP_URL));

		await settle();

		expect(httpMock.match(FRIENDSHIP_URL)).toHaveLength(0);

		renewal.flush(null);

		await settle();

		httpMock.expectOne(TRAINING_URL).flush({ uuid: 'training' });
		httpMock.expectOne(FRIENDSHIP_URL).flush([{ uuid: 'friend' }]);

		expect(await training).toEqual({ uuid: 'training' });
		expect(await friendship).toEqual([{ uuid: 'friend' }]);
		expect(httpMock.match(REFRESH_URL)).toHaveLength(0);
	});

	// A refused renewal is not the held-back request's business: it goes out as it was and
	// answers with what the API says about *it*, instead of a renewal it never asked for.
	it('releases what it held back untouched when the renewal is refused', async () => {
		const { httpClient, httpMock, sessionStore } = setUp();
		const training = firstValueFrom(httpClient.get(TRAINING_URL));

		httpMock.expectOne(TRAINING_URL).flush(null, expired);

		await settle();

		const renewal = httpMock.expectOne(REFRESH_URL);
		const friendship = firstValueFrom(httpClient.post(FRIENDSHIP_URL, { username: 'pecker' }));

		await settle();

		expect(httpMock.match(FRIENDSHIP_URL)).toHaveLength(0);

		renewal.flush(null, expired);

		// Claimed before anything else is awaited: the original 401 comes back within the
		// microtasks of this flush, and a rejection nobody is holding fails the whole run.
		await expect(training).rejects.toBeInstanceOf(HttpErrorResponse);
		await settle();

		expect(sessionStore.isAnonymous()).toBe(true);

		const released = httpMock.expectOne(FRIENDSHIP_URL);

		expect(released.request.withCredentials).toBe(true);
		expect(released.request.body).toEqual({ username: 'pecker' });

		released.flush(null, expired);

		await expect(friendship).rejects.toBeInstanceOf(HttpErrorResponse);
		expect(httpMock.match(REFRESH_URL)).toHaveLength(0);
	});

	it('stops asking for a renewal once the session is known to be gone', async () => {
		const { httpClient, httpMock, sessionStore } = setUp();

		sessionStore.expire();

		const response = firstValueFrom(httpClient.get(TRAINING_URL));

		httpMock.expectOne(TRAINING_URL).flush(null, expired);

		await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
		expect(httpMock.match(REFRESH_URL)).toHaveLength(0);
	});

	// A 401 from the login is the answer to the credentials, not an expired cookie.
	it('leaves the login to answer for itself', async () => {
		const { httpClient, httpMock } = setUp();
		const response = firstValueFrom(httpClient.post(LOGIN_URL, {}));

		httpMock.expectOne(LOGIN_URL).flush(null, expired);

		await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
		expect(httpMock.match(REFRESH_URL)).toHaveLength(0);
	});

	it('sends whoever was logged in to the login page when the renewal is refused', async () => {
		const { httpClient, httpMock, sessionStore, router } = setUp();

		patchState(sessionStore, { status: 'authenticated' });

		const response = firstValueFrom(httpClient.get(TRAINING_URL));

		httpMock.expectOne(TRAINING_URL).flush(null, expired);

		await settle();

		httpMock.expectOne(REFRESH_URL).flush(null, expired);

		await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
		expect(sessionStore.isAnonymous()).toBe(true);
		expect(router.navigate).toHaveBeenCalledWith(['/login']);
	});

	// Loading the app without cookies ends here too, and bouncing that visitor to the
	// login page would be a redirect nobody asked for.
	it('drops the session without moving an anonymous visitor', async () => {
		const { httpClient, httpMock, sessionStore, router } = setUp();
		const response = firstValueFrom(httpClient.get(TRAINING_URL));

		httpMock.expectOne(TRAINING_URL).flush(null, expired);

		await settle();

		httpMock.expectOne(REFRESH_URL).flush(null, expired);

		await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
		expect(sessionStore.isAnonymous()).toBe(true);
		expect(router.navigate).not.toHaveBeenCalled();
	});

	it('leaves any other failure to the caller', async () => {
		const { httpClient, httpMock } = setUp();
		const response = firstValueFrom(httpClient.get(TRAINING_URL));

		httpMock.expectOne(TRAINING_URL).flush(null, { status: 500, statusText: 'Server Error' });

		await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
		expect(httpMock.match(REFRESH_URL)).toHaveLength(0);
	});
});

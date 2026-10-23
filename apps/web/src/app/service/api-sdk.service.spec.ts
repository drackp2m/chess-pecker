import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Event, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE_URL } from '@app/definition/api.constant';
import { ApiSdkService } from '@app/service/api-sdk.service';
import { NotificationService } from '@app/service/notification.service';
import { ConnectionStore } from '@app/store/connection.store';
import { toFailurePhase } from '@app/use-case/sync/sync-cycle.use-case';
import { ApiCancelledError } from '@app/util/api-cancelled-error';

const SUMMARY_URL = `${API_BASE_URL}/sync`;

const START_URL = `${API_BASE_URL}/training`;

const NEVER_ANSWERS_MS = 10 * 60 * 1000;

const SLOW_TO_WAKE_MS = 30 * 1000;

interface Watched {
	readonly failure: () => unknown;
}

function watch(answer: Promise<unknown>): Watched {
	let failure: unknown;

	void answer.catch((error: unknown) => {
		failure = error;
	});

	return { failure: () => failure };
}

function navigateAway(navigations: Subject<Event>): void {
	navigations.next(new NavigationStart(1, '/elsewhere'));
}

function configure() {
	const navigations = new Subject<Event>();

	TestBed.configureTestingModule({
		providers: [
			provideHttpClient(),
			provideHttpClientTesting(),
			{ provide: Router, useValue: { events: navigations } },
			{ provide: NotificationService, useValue: { notify: vi.fn() } },
		],
	});

	return {
		navigations,
		sdk: TestBed.inject(ApiSdkService),
		http: TestBed.inject(HttpTestingController),
		connection: TestBed.inject(ConnectionStore),
	};
}

describe('ApiSdkService', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('cancels a read when the router navigates', async () => {
		const { sdk, http, navigations } = configure();
		const answer = sdk.GET.sync('');

		http.expectOne(SUMMARY_URL);
		navigateAway(navigations);

		await expect(answer).rejects.toBeInstanceOf(ApiCancelledError);
	});

	it('does not cancel a write when the router navigates', async () => {
		const { sdk, http, navigations } = configure();
		const answer = sdk.POST.training('');
		const request = http.expectOne(START_URL);

		navigateAway(navigations);
		request.flush({ uuid: 'training-1' });

		await expect(answer).resolves.toEqual({ uuid: 'training-1' });
	});

	it('does not cancel a read marked as not cancellable', async () => {
		const { sdk, http, navigations } = configure();
		const answer = sdk.GET.sync('', { cancellable: false });
		const request = http.expectOne(SUMMARY_URL);

		navigateAway(navigations);
		request.flush({ catalog: null });

		await expect(answer).resolves.toEqual({ catalog: null });
	});

	it('counts reads and writes in flight and gives them back when they end', async () => {
		const { sdk, http } = configure();
		const read = sdk.GET.sync('');
		const write = sdk.POST.training('');

		expect(sdk.isFetching()).toBe(true);
		expect(sdk.isSaving()).toBe(true);
		expect(sdk.pendingWrites()).toBe(1);

		http.expectOne((request) => 'GET' === request.method).flush({});
		http.expectOne((request) => 'POST' === request.method).flush({});
		await Promise.all([read, write]);

		expect(sdk.isFetching()).toBe(false);
		expect(sdk.isSaving()).toBe(false);
		expect(sdk.pendingWrites()).toBe(0);
	});
});

describe('ApiSdkService, with a request that hangs', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('waits for a server that is slow to wake up', async () => {
		const { sdk, http } = configure();
		const answer = sdk.GET.sync('');
		const request = http.expectOne(SUMMARY_URL);

		await vi.advanceTimersByTimeAsync(SLOW_TO_WAKE_MS);
		request.flush({ catalog: null });

		await expect(answer).resolves.toEqual({ catalog: null });
	});

	it('fails a request that never answers', async () => {
		const { sdk, http } = configure();
		const watched = watch(sdk.GET.sync('', { cancellable: false }));

		http.expectOne(SUMMARY_URL);
		await vi.advanceTimersByTimeAsync(NEVER_ANSWERS_MS);

		await vi.waitFor(() => {
			expect(watched.failure()).toBeInstanceOf(HttpErrorResponse);
		});
	});

	it('fails it in a way the sync reads as a cut', async () => {
		const { sdk, http, connection } = configure();
		const watched = watch(sdk.POST.training(''));

		http.expectOne(START_URL);
		await vi.advanceTimersByTimeAsync(NEVER_ANSWERS_MS);

		await vi.waitFor(() => {
			expect(toFailurePhase(watched.failure())).toBe('offline');
		});
		expect(connection.isUnreachable()).toBe(true);
	});
});

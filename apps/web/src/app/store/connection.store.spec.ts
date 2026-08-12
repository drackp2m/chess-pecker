import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConnectionStore } from '@app/store/connection.store';
import { provideTestingI18n } from '@app/testing/i18n.harness';
import { ApiCancelledError } from '@app/util/api-cancelled-error';

interface Deferred {
	promise: Promise<string>;
	answer: (value: string) => void;
	fail: (error: unknown) => void;
}

function defer(): Deferred {
	let answer!: (value: string) => void;
	let fail!: (error: unknown) => void;

	const promise = new Promise<string>((resolve, reject) => {
		answer = resolve;
		fail = reject;
	});

	return { promise, answer, fail };
}

function createStore(): ConnectionStore {
	TestBed.configureTestingModule({ providers: [provideTestingI18n(), ConnectionStore] });

	return TestBed.inject(ConnectionStore);
}

describe('ConnectionStore', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
		vi.useRealTimers();
	});

	it('says nothing about a call that answers straight away', async () => {
		const store = createStore();

		await store.track(Promise.resolve('answer'));

		expect(store.phase()).toBe('idle');
	});

	it('says how long the call is taking while it waits', async () => {
		vi.useFakeTimers();

		const store = createStore();
		const pending = defer();
		const tracked = store.track(pending.promise);

		expect(store.phase()).toBe('idle');

		vi.advanceTimersByTime(2000);

		expect(store.phase()).toBe('connecting');

		vi.advanceTimersByTime(8000);

		expect(store.phase()).toBe('waking');

		pending.answer('answer');
		await tracked;

		expect(store.phase()).toBe('idle');
	});

	// The reason the phase follows the oldest call and not the count: a page firing a
	// request a second would otherwise claim the server is asleep while it answers.
	it('follows the oldest call still out, not the ones that keep starting', async () => {
		vi.useFakeTimers();

		const store = createStore();
		const first = defer();
		const tracked = store.track(first.promise);

		vi.advanceTimersByTime(2000);

		const second = defer();
		const trackedSecond = store.track(second.promise);

		expect(store.phase()).toBe('connecting');

		first.answer('answer');
		await tracked;

		expect(store.phase()).toBe('idle');

		second.answer('answer');
		await trackedSecond;
	});

	it('reports a server that does not answer as unreachable', async () => {
		const store = createStore();

		await expect(
			store.track(Promise.reject(new HttpErrorResponse({ status: 0 }))),
		).rejects.toBeInstanceOf(HttpErrorResponse);

		expect(store.phase()).toBe('unreachable');
	});

	// A refused request is an answer: the server is there, and saying "no connection"
	// because a call was rejected would be a lie the user cannot act on.
	it('leaves the connection alone when the server answers badly', async () => {
		const store = createStore();

		await expect(
			store.track(Promise.reject(new HttpErrorResponse({ status: 404 }))),
		).rejects.toBeInstanceOf(HttpErrorResponse);

		expect(store.phase()).toBe('idle');
	});

	it('says nothing about a call cancelled by a navigation', async () => {
		const store = createStore();

		await expect(
			store.track(Promise.reject(new ApiCancelledError('GET /training'))),
		).rejects.toBeInstanceOf(ApiCancelledError);

		expect(store.phase()).toBe('idle');
	});

	it('comes back as soon as any call answers', async () => {
		const store = createStore();

		await expect(
			store.track(Promise.reject(new HttpErrorResponse({ status: 503 }))),
		).rejects.toBeInstanceOf(HttpErrorResponse);

		expect(store.isUnreachable()).toBe(true);

		await store.track(Promise.resolve('answer'));

		expect(store.isUnreachable()).toBe(false);
	});
});

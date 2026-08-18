import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SyncPhase } from '@app/definition/sync-phase.type';
import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { SessionStore } from '@app/store/session.store';
import { SyncStore } from '@app/store/sync.store';
import { SyncCycleUseCase, SyncReport } from '@app/use-case/sync/sync-cycle.use-case';

type CycleRun = (report: SyncReport) => Promise<SyncPhase>;

function never<T>(): Promise<T> {
	return new Promise<T>(() => undefined);
}

function configure(execute: CycleRun): SyncStore {
	TestBed.configureTestingModule({
		providers: [
			SyncStore,
			{ provide: SyncCycleUseCase, useValue: { execute: vi.fn(execute), flush: vi.fn() } },
			{
				provide: SessionStore,
				useValue: { isAuthenticated: () => false, status: () => 'anonymous' },
			},
		],
	});

	return TestBed.inject(SyncStore);
}

describe('SyncStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('opens the gate when the pass ends with the server refusing', async () => {
		const store = configure(() => Promise.resolve('failed'));

		await store.start();

		expect(store.isReady()).toBe(true);
		expect(store.phase()).toBe('failed');
	});

	it('opens the gate when the pass ends without network', async () => {
		const store = configure(() => Promise.resolve('offline'));

		await store.start();

		expect(store.isReady()).toBe(true);
		expect(store.phase()).toBe('offline');
	});

	it('opens the gate on its own when the pass never comes back', async () => {
		const store = configure(() => never<SyncPhase>());

		const ready = store.start();

		await vi.advanceTimersByTimeAsync(SyncPolicy.startupTimeoutMs);
		await ready;

		expect(store.isReady()).toBe(true);
		expect(store.phase()).toBe('idle');
	});

	it('opens the gate as soon as nothing is left to download', async () => {
		const store = configure(async (report) => {
			await Promise.resolve();
			report({ phase: 'pulling', isReplicaComplete: true });

			return never<SyncPhase>();
		});

		await store.start();

		expect(store.isReady()).toBe(true);
		expect(store.isSyncing()).toBe(true);
	});

	it('lets everything that was waiting through with a single opening', async () => {
		const store = configure(() => Promise.resolve('ready'));
		const first = store.whenReady();
		const second = store.whenReady();

		void store.sync();

		await Promise.all([first, second]);

		expect(store.isReady()).toBe(true);
	});

	it('takes the counts of whoever leaves, but not the open gate', async () => {
		const store = configure((report) => {
			report({ pending: 3, uploaded: 2 });

			return Promise.resolve('ready');
		});

		await store.start();

		expect(store.pending()).toBe(3);
		expect(store.lastSyncedAt()).not.toBeNull();

		store.reset();

		expect(store.isReady()).toBe(true);
		expect(store.pending()).toBe(0);
		expect(store.uploaded()).toBe(0);
		expect(store.lastSyncedAt()).toBeNull();
		await expect(store.whenReady()).resolves.toBeUndefined();
	});
});

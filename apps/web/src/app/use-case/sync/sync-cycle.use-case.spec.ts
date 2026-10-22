import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalDataRepository, NO_PENDING } from '@app/repository/local-data.repository';
import { SessionStore } from '@app/store/session.store';
import { BookmarkMirrorUseCase } from '@app/use-case/bookmark-mirror.use-case';
import { PuzzleCatalogReplicaUseCase } from '@app/use-case/puzzle-catalog-replica.use-case';
import { RepairCycleUseCase } from '@app/use-case/repair-cycle.use-case';
import { SettingMirrorUseCase } from '@app/use-case/setting-mirror.use-case';
import { ShareMirrorUseCase } from '@app/use-case/share-mirror.use-case';
import { OrphanRepairUseCase } from '@app/use-case/sync/orphan-repair.use-case';
import { SyncCycleUseCase, toFailurePhase } from '@app/use-case/sync/sync-cycle.use-case';
import { SyncPullUseCase } from '@app/use-case/sync/sync-pull.use-case';
import { SyncPushUseCase } from '@app/use-case/sync/sync-push.use-case';
import { SyncSummaryUseCase } from '@app/use-case/sync/sync-summary.use-case';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { SYNC_LOCK, withExclusiveLock } from '@app/util/exclusive-lock';

const CATALOG = { version: 'v1', total: 2 };

interface Gate {
	readonly promise: Promise<void>;
	readonly open: () => void;
}

function gate(): Gate {
	let open: () => void = () => undefined;
	const promise = new Promise<void>((resolve) => {
		open = resolve;
	});

	return {
		promise,
		open: () => {
			open();
		},
	};
}

function answeredWith(status: number): HttpErrorResponse {
	return new HttpErrorResponse({ status, error: null });
}

function configure(authenticated: boolean, sweep: Gate) {
	const catalog = {
		run: vi.fn(() => sweep.promise),
		isSynced: vi.fn(() => Promise.resolve(false)),
	};
	const status = {
		summary: { catalog: CATALOG, shares: { cursor: null, count: 0 }, partialCycles: [] },
		canPush: true,
		behind: [],
		treeCursor: undefined,
	};

	TestBed.configureTestingModule({
		providers: [
			{ provide: SessionStore, useValue: { isAuthenticated: () => authenticated } },
			{ provide: SyncSummaryUseCase, useValue: { read: () => Promise.resolve(status) } },
			{
				provide: SyncPushUseCase,
				useValue: {
					execute: () =>
						Promise.resolve({ confirmed: 0, rejected: 0, pendingTrainings: 0, interrupted: false }),
				},
			},
			{
				provide: SyncPullUseCase,
				useValue: { execute: () => Promise.resolve({ trainings: 0, rows: 0, interrupted: false }) },
			},
			{ provide: PuzzleCatalogReplicaUseCase, useValue: catalog },
			{ provide: RepairCycleUseCase, useValue: { repairAll: () => Promise.resolve([]) } },
			{ provide: OrphanRepairUseCase, useValue: { execute: () => Promise.resolve(0) } },
			{ provide: ShareMirrorUseCase, useValue: { pull: () => Promise.resolve() } },
			{
				provide: BookmarkMirrorUseCase,
				useValue: { pull: () => Promise.resolve([]), push: () => Promise.resolve() },
			},
			{ provide: SettingMirrorUseCase, useValue: { pushPending: () => Promise.resolve() } },
			{
				provide: LocalDataRepository,
				useValue: { countPendingByEntity: () => Promise.resolve(NO_PENDING) },
			},
		],
	});

	return { catalog, cycle: TestBed.inject(SyncCycleUseCase) };
}

describe('toFailurePhase', () => {
	it('reads a cancelled request as a pass that was cut, not refused', () => {
		expect(toFailurePhase(new ApiCancelledError('GET /sync'))).toBe('offline');
	});

	it('reads a request that never got an answer as a cut', () => {
		expect(toFailurePhase(answeredWith(0))).toBe('offline');
	});

	it('reads a timeout as a cut', () => {
		expect(toFailurePhase(answeredWith(408))).toBe('offline');
	});

	it('reads a gateway that is asleep or busy as a cut', () => {
		expect(toFailurePhase(answeredWith(502))).toBe('offline');
		expect(toFailurePhase(answeredWith(503))).toBe('offline');
		expect(toFailurePhase(answeredWith(504))).toBe('offline');
	});

	it('reads a session the server no longer honours as a refusal', () => {
		expect(toFailurePhase(answeredWith(401))).toBe('failed');
	});

	it('reads a manifest the server will not take as a refusal', () => {
		expect(toFailurePhase(answeredWith(422))).toBe('failed');
	});

	it('reads a server that answered with its own error as a refusal', () => {
		expect(toFailurePhase(answeredWith(500))).toBe('failed');
	});

	it('reads anything that is not an answer at all as a refusal', () => {
		expect(toFailurePhase(new Error('the database is closed'))).toBe('failed');
		expect(toFailurePhase(undefined)).toBe('failed');
	});
});

describe('SyncCycleUseCase, while the catalogue is being swept', () => {
	let sweep = gate();

	afterEach(() => {
		sweep.open();
		sweep = gate();
		TestBed.resetTestingModule();
	});

	it.each([
		{ label: 'with a session', authenticated: true },
		{ label: 'without a session', authenticated: false },
	])('lets the sync lock go before sweeping the catalogue, $label', async ({ authenticated }) => {
		const { catalog, cycle } = configure(authenticated, sweep);
		let entered = false;

		void cycle.execute(() => undefined);

		await vi.waitFor(() => {
			expect(catalog.run).toHaveBeenCalledTimes(1);
		});

		void withExclusiveLock(SYNC_LOCK, () => {
			entered = true;

			return Promise.resolve();
		});

		await vi.waitFor(() => {
			expect(entered).toBe(true);
		});
	});
});

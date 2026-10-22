import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PuzzleBookmark, PuzzleBookmarkType } from '@chesspecker/api-definitions';
import {
	IDBCursor,
	IDBDatabase,
	IDBFactory,
	IDBIndex,
	IDBKeyRange,
	IDBObjectStore,
	IDBRequest,
	IDBTransaction,
} from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BookmarkLocalRepository } from '@app/repository/bookmark-local.repository';
import { BookmarkRow } from '@app/repository/definition/bookmark-schema.interface';
import { PuzzleBookmarkRepository } from '@app/repository/puzzle-bookmark.repository';
import { SessionStore } from '@app/store/session.store';
import { BookmarkMirrorUseCase } from '@app/use-case/bookmark-mirror.use-case';

const LICHESS_ID = 'abcde';

const OLD = new Date('2026-08-01T10:00:00.000Z');

const NEW = new Date('2026-08-02T10:00:00.000Z');

const NOW = new Date('2026-08-03T10:00:00.000Z');

interface Gate<T> {
	readonly promise: Promise<T>;
	readonly open: (value: T) => void;
}

function gate<T>(): Gate<T> {
	let open: (value: T) => void = (_value) => undefined;
	const promise = new Promise<T>((resolve) => {
		open = resolve;
	});

	return {
		promise,
		open: (value) => {
			open(value);
		},
	};
}

function remoteBookmark(type: PuzzleBookmarkType, updatedAt: Date): PuzzleBookmark {
	return {
		uuid: 'bookmark-1',
		lichessId: LICHESS_ID,
		type,
		createdAt: OLD.toISOString(),
		updatedAt: updatedAt.toISOString(),
	};
}

function pending(): BookmarkRow {
	return {
		lichessId: LICHESS_ID,
		type: 'favorite',
		createdAt: OLD,
		updatedAt: OLD,
		history: [{ uuid: 'event-1', type: 'favorite', createdAt: OLD }],
	};
}

function settled(): BookmarkRow {
	return {
		lichessId: LICHESS_ID,
		type: 'favorite',
		createdAt: OLD,
		updatedAt: OLD,
		syncedAt: OLD,
		history: [{ uuid: 'event-1', type: 'favorite', createdAt: OLD, syncedAt: OLD }],
	};
}

function configure() {
	Object.assign(globalThis, {
		indexedDB: new IDBFactory(),
		IDBCursor,
		IDBDatabase,
		IDBIndex,
		IDBKeyRange,
		IDBObjectStore,
		IDBRequest,
		IDBTransaction,
	});

	const remote = {
		list: vi.fn((): Promise<readonly PuzzleBookmark[]> => Promise.resolve([])),
		upsert: vi.fn(
			(_lichessId: string, type: PuzzleBookmarkType, updatedAt: Date): Promise<PuzzleBookmark> =>
				Promise.resolve(remoteBookmark(type, updatedAt)),
		),
		remove: vi.fn((): Promise<void> => Promise.resolve()),
	};

	TestBed.resetTestingModule();
	TestBed.configureTestingModule({
		providers: [
			{ provide: PuzzleBookmarkRepository, useValue: remote },
			{ provide: SessionStore, useValue: { isAuthenticated: signal(true) } },
		],
	});

	return {
		remote,
		local: TestBed.inject(BookmarkLocalRepository),
		mirror: TestBed.inject(BookmarkMirrorUseCase),
	};
}

async function current(local: BookmarkLocalRepository): Promise<BookmarkRow> {
	const row = await local.find('bookmark', LICHESS_ID);

	if (undefined === row) {
		throw new Error('The exercise is not filed on this device');
	}

	return row;
}

describe('BookmarkMirrorUseCase, while a trip to the account is in flight', () => {
	let remote: ReturnType<typeof configure>['remote'];
	let local: BookmarkLocalRepository;
	let mirror: BookmarkMirrorUseCase;

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(NOW);

		({ remote, local, mirror } = configure());
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	describe('push', () => {
		let trip: Gate<PuzzleBookmark>;
		let pushing: Promise<void>;

		beforeEach(async () => {
			trip = gate<PuzzleBookmark>();
			remote.upsert.mockImplementationOnce(() => trip.promise);

			await local.save(pending());

			pushing = mirror.push();

			await vi.waitFor(() => {
				expect(remote.upsert).toHaveBeenCalledTimes(1);
			});
			vi.setSystemTime(NOW);
		});

		it('keeps a filing made while the push was in flight', async () => {
			await mirror.file(LICHESS_ID, await current(local), 'hard');

			trip.open(remoteBookmark('favorite', OLD));
			await pushing;

			const row = await current(local);

			expect(row.type).toBe('hard');
			expect(row.history?.map((entry) => entry.type)).toEqual(['favorite', 'hard']);
		});

		it('keeps an unfiling made while the push was in flight', async () => {
			await mirror.unfile(await current(local));

			trip.open(remoteBookmark('favorite', OLD));
			await pushing;

			await expect(current(local)).resolves.toMatchObject({ removedAt: NOW });
		});

		it('leaves waiting the event that did not go up yet', async () => {
			remote.upsert.mockRejectedValue(new Error('offline'));

			await mirror.file(LICHESS_ID, await current(local), 'hard');

			trip.open(remoteBookmark('favorite', OLD));
			await pushing;

			const filing = (await current(local)).history?.find((entry) => 'hard' === entry.type);

			expect(filing).toBeDefined();
			expect(filing?.syncedAt).toBeUndefined();
			await expect(mirror.hasPending()).resolves.toBe(true);
		});
	});

	describe('pull', () => {
		it('does not overwrite a row that changed while the lists came down', async () => {
			const lists = gate<readonly PuzzleBookmark[]>();

			remote.list.mockImplementationOnce(() => lists.promise);
			remote.upsert.mockRejectedValue(new Error('offline'));

			await local.save(settled());

			const pulling = mirror.pull();

			await vi.waitFor(() => {
				expect(remote.list).toHaveBeenCalledTimes(1);
			});
			vi.setSystemTime(NOW);

			await mirror.file(LICHESS_ID, await current(local), 'hard');

			lists.open([remoteBookmark('easy', NEW)]);
			await pulling;

			await expect(current(local)).resolves.toMatchObject({ type: 'hard', updatedAt: NOW });
		});
	});
});

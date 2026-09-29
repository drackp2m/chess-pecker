import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PuzzleBookmark, PuzzleBookmarkType } from '@chesspecker/api-definitions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AttemptRepository } from '@app/repository/attempt.repository';
import { BookmarkLocalRepository } from '@app/repository/bookmark-local.repository';
import {
	BookmarkHistoryRow,
	BookmarkRow,
} from '@app/repository/definition/bookmark-schema.interface';
import { PuzzleBookmarkRepository } from '@app/repository/puzzle-bookmark.repository';
import { SessionStore } from '@app/store/session.store';
import { BookmarkMirrorUseCase } from '@app/use-case/bookmark-mirror.use-case';

const LICHESS_ID = 'abcde';
const OTHER_ID = 'fghij';
const ATTEMPT = '0b7e3c1a-5f7e-4d0a-9c1e-2b8f6a4d3e21';

const OLD = new Date('2026-08-01T10:00:00.000Z');
const NEW = new Date('2026-08-02T10:00:00.000Z');
const NOW = new Date('2026-08-03T10:00:00.000Z');

interface Options {
	readonly rows?: readonly BookmarkRow[];
	readonly remote?: readonly PuzzleBookmark[];
	readonly authenticated?: boolean;
	readonly nearestAttempt?: string;
}

function row(over: Partial<BookmarkRow> = {}): BookmarkRow {
	return {
		lichessId: LICHESS_ID,
		type: 'favorite',
		createdAt: OLD,
		updatedAt: OLD,
		...over,
	};
}

function event(over: Partial<BookmarkHistoryRow> = {}): BookmarkHistoryRow {
	return {
		uuid: 'event-1',
		type: 'favorite',
		createdAt: OLD,
		...over,
	};
}

function settled(over: Partial<BookmarkRow> = {}): BookmarkRow {
	return row({ syncedAt: OLD, history: [event({ syncedAt: OLD })], ...over });
}

function remoteBookmark(over: Partial<PuzzleBookmark> = {}): PuzzleBookmark {
	return {
		uuid: 'bookmark-1',
		lichessId: LICHESS_ID,
		type: 'hard',
		createdAt: OLD.toISOString(),
		updatedAt: OLD.toISOString(),
		...over,
	};
}

function configure(options: Options = {}) {
	const stored = new Map((options.rows ?? []).map((stock) => [stock.lichessId, stock]));
	const local = {
		readAll: vi.fn(() => Promise.resolve([...stored.values()])),
		save: vi.fn((next: BookmarkRow) => {
			stored.set(next.lichessId, next);

			return Promise.resolve(next);
		}),
		saveAll: vi.fn((next: readonly BookmarkRow[]) => {
			for (const each of next) {
				stored.set(each.lichessId, each);
			}

			return Promise.resolve();
		}),
		remove: vi.fn((lichessId: string) => {
			stored.delete(lichessId);

			return Promise.resolve();
		}),
	};
	const remote = {
		list: vi.fn(() => Promise.resolve(options.remote ?? [])),
		upsert: vi.fn(
			(
				lichessId: string,
				type: PuzzleBookmarkType,
				updatedAt: Date,
				_eventUuid?: string,
				_attemptUuid?: string,
			): Promise<PuzzleBookmark> =>
				Promise.resolve(remoteBookmark({ lichessId, type, updatedAt: updatedAt.toISOString() })),
		),
		remove: vi.fn(
			(
				_lichessId: string,
				_eventUuid?: string,
				_attemptUuid?: string,
				_updatedAt?: Date,
			): Promise<void> => Promise.resolve(),
		),
	};
	const attempts = {
		findNearestBefore: vi.fn(() =>
			Promise.resolve(
				undefined === options.nearestAttempt ? undefined : { uuid: options.nearestAttempt },
			),
		),
	};
	const isAuthenticated = signal(options.authenticated ?? true);

	TestBed.configureTestingModule({
		providers: [
			{ provide: BookmarkLocalRepository, useValue: local },
			{ provide: PuzzleBookmarkRepository, useValue: remote },
			{ provide: AttemptRepository, useValue: attempts },
			{ provide: SessionStore, useValue: { isAuthenticated } },
		],
	});

	return { stored, local, remote, attempts, mirror: TestBed.inject(BookmarkMirrorUseCase) };
}

describe('BookmarkMirrorUseCase', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	describe('file', () => {
		it('writes the row on this device and leaves it pending while logged out', async () => {
			const { stored, remote, mirror } = configure({ authenticated: false });

			const saved = await mirror.file(LICHESS_ID, undefined, 'hard', ATTEMPT);

			expect(saved).toMatchObject({
				lichessId: LICHESS_ID,
				type: 'hard',
				attemptUuid: ATTEMPT,
				createdAt: NOW,
				updatedAt: NOW,
			});
			expect(saved.syncedAt).toBeUndefined();
			expect(saved.history).toEqual([
				{ uuid: expect.any(String), type: 'hard', createdAt: NOW, attemptUuid: ATTEMPT },
			]);
			expect(stored.get(LICHESS_ID)).toEqual(saved);
			expect(remote.upsert).not.toHaveBeenCalled();
			expect(await mirror.hasPending()).toBe(true);
		});

		it('sends the filing as its own event and seals the row', async () => {
			const { stored, remote, mirror } = configure();

			const saved = await mirror.file(LICHESS_ID, undefined, 'hard', ATTEMPT);
			const [filing] = saved.history ?? [];

			expect(remote.upsert).toHaveBeenCalledTimes(1);
			expect(remote.upsert).toHaveBeenCalledWith(LICHESS_ID, 'hard', NOW, filing?.uuid, ATTEMPT);
			expect(saved.syncedAt).toEqual(NOW);
			expect(filing?.syncedAt).toEqual(NOW);
			expect(stored.get(LICHESS_ID)).toEqual(saved);
			expect(await mirror.hasPending()).toBe(false);
		});

		it('keeps the row pending when the trip fails', async () => {
			const { stored, remote, mirror } = configure();

			remote.upsert.mockRejectedValueOnce(new Error('offline'));

			const saved = await mirror.file(LICHESS_ID, undefined, 'hard');

			expect(saved.syncedAt).toBeUndefined();
			expect(stored.get(LICHESS_ID)?.type).toBe('hard');
			expect(await mirror.hasPending()).toBe(true);
		});

		it('moves an exercise already filed, keeping when it was first filed and its history', async () => {
			const current = settled();
			const { mirror } = configure({ rows: [current] });

			const saved = await mirror.file(LICHESS_ID, current, 'easy');

			expect(saved.type).toBe('easy');
			expect(saved.createdAt).toEqual(OLD);
			expect(saved.history?.map((each) => each.type)).toEqual(['favorite', 'easy']);
			expect(saved.history?.[0]).toEqual(current.history?.[0]);
		});

		it('files again an exercise that was unfiled without carrying the tombstone along', async () => {
			const current = settled({ updatedAt: NEW, removedAt: NEW, syncedAt: NEW });
			const { stored, mirror } = configure({ rows: [current] });

			const saved = await mirror.file(LICHESS_ID, current, 'hard');

			expect(saved.removedAt).toBeUndefined();
			expect(stored.get(LICHESS_ID)?.removedAt).toBeUndefined();
		});
	});

	describe('unfile', () => {
		it('leaves a sealed tombstone and sends the removal as its own event', async () => {
			const current = settled();
			const { stored, remote, mirror } = configure({ rows: [current] });

			await mirror.unfile(current, ATTEMPT);

			const tombstone = stored.get(LICHESS_ID);
			const removal = tombstone?.history?.at(-1);

			expect(tombstone).toMatchObject({ removedAt: NOW, updatedAt: NOW, syncedAt: NOW });
			expect(removal).toMatchObject({ type: null, createdAt: NOW, attemptUuid: ATTEMPT });
			expect(remote.remove).toHaveBeenCalledTimes(1);
			expect(remote.remove).toHaveBeenCalledWith(LICHESS_ID, removal?.uuid, ATTEMPT, NOW);
		});

		it('leaves a pending tombstone while logged out', async () => {
			const current = settled();
			const { stored, remote, mirror } = configure({ rows: [current], authenticated: false });

			await mirror.unfile(current);

			expect(stored.get(LICHESS_ID)).toMatchObject({ removedAt: NOW, syncedAt: OLD });
			expect(remote.remove).not.toHaveBeenCalled();
			expect(await mirror.hasPending()).toBe(true);
		});
	});

	describe('push', () => {
		it('sends only the rows that are pending, and nothing the second time', async () => {
			const pending = row({ type: 'hard', history: [event({ type: 'hard' })] });
			const { remote, mirror } = configure({
				rows: [pending, settled({ lichessId: OTHER_ID })],
			});

			await mirror.push();
			await mirror.push();

			expect(remote.upsert).toHaveBeenCalledTimes(1);
			expect(remote.upsert).toHaveBeenCalledWith(LICHESS_ID, 'hard', OLD, 'event-1', undefined);
			expect(await mirror.hasPending()).toBe(false);
		});

		it('sends every unsent event of a row in order, and only those', async () => {
			const tombstone = row({
				updatedAt: NEW,
				removedAt: NEW,
				syncedAt: OLD,
				history: [
					event({ syncedAt: OLD }),
					event({ uuid: 'event-2', type: 'hard', createdAt: OLD }),
					event({ uuid: 'event-3', type: null, createdAt: NEW, attemptUuid: ATTEMPT }),
				],
			});
			const { stored, remote, mirror } = configure({ rows: [tombstone] });

			await mirror.push();

			expect(remote.upsert).toHaveBeenCalledTimes(1);
			expect(remote.upsert).toHaveBeenCalledWith(LICHESS_ID, 'hard', OLD, 'event-2', undefined);
			expect(remote.remove).toHaveBeenCalledTimes(1);
			expect(remote.remove).toHaveBeenCalledWith(LICHESS_ID, 'event-3', ATTEMPT, NEW);
			expect(remote.upsert.mock.invocationCallOrder[0]).toBeLessThan(
				remote.remove.mock.invocationCallOrder[0] ?? 0,
			);
			expect(stored.get(LICHESS_ID)?.syncedAt).toEqual(NEW);
		});

		it('resumes after the last event that got through when a trip fails halfway', async () => {
			const pending = row({
				type: 'easy',
				updatedAt: NEW,
				history: [
					event({ uuid: 'event-1', type: 'hard', createdAt: OLD }),
					event({ uuid: 'event-2', type: 'easy', createdAt: NEW }),
				],
			});
			const { stored, remote, mirror } = configure({ rows: [pending] });

			remote.upsert
				.mockResolvedValueOnce(remoteBookmark())
				.mockRejectedValueOnce(new Error('offline'));

			await mirror.push();

			const halfway = stored.get(LICHESS_ID);

			expect(halfway?.syncedAt).toBeUndefined();
			expect(halfway?.history?.map((each) => each.syncedAt)).toEqual([OLD, undefined]);

			await mirror.push();

			expect(remote.upsert.mock.calls.map((call) => call[3])).toEqual([
				'event-1',
				'event-2',
				'event-2',
			]);
			expect(await mirror.hasPending()).toBe(false);
		});

		it('adopts the account version when the account kept a newer filing', async () => {
			const pending = row({ type: 'hard', history: [event({ type: 'hard' })] });
			const { stored, remote, mirror } = configure({ rows: [pending] });

			remote.upsert.mockResolvedValueOnce(
				remoteBookmark({ type: 'easy', attemptUuid: ATTEMPT, updatedAt: NEW.toISOString() }),
			);

			await mirror.push();

			expect(stored.get(LICHESS_ID)).toEqual({
				lichessId: LICHESS_ID,
				type: 'easy',
				attemptUuid: ATTEMPT,
				createdAt: OLD,
				updatedAt: NEW,
				syncedAt: NEW,
				history: [event({ type: 'hard', syncedAt: OLD })],
			});
			expect(await mirror.hasPending()).toBe(false);
		});

		it('keeps its own version when the account answers with an older one', async () => {
			const pending = row({ type: 'hard', updatedAt: NEW, history: [event({ type: 'hard' })] });
			const { stored, remote, mirror } = configure({ rows: [pending] });

			remote.upsert.mockResolvedValueOnce(remoteBookmark({ type: 'easy' }));

			await mirror.push();

			expect(stored.get(LICHESS_ID)).toMatchObject({ type: 'hard', updatedAt: NEW, syncedAt: NEW });
		});

		it('carries on with the next row when one fails', async () => {
			const first = row({ type: 'hard', history: [event({ type: 'hard' })] });
			const second = row({
				lichessId: OTHER_ID,
				type: 'easy',
				history: [event({ uuid: 'event-2', type: 'easy' })],
			});
			const { stored, remote, mirror } = configure({ rows: [first, second] });

			remote.upsert.mockRejectedValueOnce(new Error('offline'));

			await mirror.push();

			expect(remote.upsert).toHaveBeenCalledTimes(2);
			expect(stored.get(LICHESS_ID)?.syncedAt).toBeUndefined();
			expect(stored.get(OTHER_ID)?.syncedAt).toEqual(OLD);
		});

		it('sends the current state of a row saved before there was a history', async () => {
			const filed = row({ type: 'hard', attemptUuid: ATTEMPT });
			const removed = row({ lichessId: OTHER_ID, updatedAt: NEW, removedAt: NEW });
			const { remote, mirror } = configure({ rows: [filed, removed] });

			await mirror.push();

			expect(remote.upsert).toHaveBeenCalledWith(LICHESS_ID, 'hard', OLD, undefined, ATTEMPT);
			expect(remote.remove).toHaveBeenCalledWith(OTHER_ID, undefined, undefined, NEW);
		});

		it('sends nothing while logged out', async () => {
			const pending = row({ history: [event()] });
			const { stored, remote, mirror } = configure({ rows: [pending], authenticated: false });

			await mirror.push();

			expect(remote.upsert).not.toHaveBeenCalled();
			expect(remote.remove).not.toHaveBeenCalled();
			expect(stored.get(LICHESS_ID)).toEqual(pending);
		});
	});

	describe('pull', () => {
		it('brings down what the account files and this device lacks', async () => {
			const { stored, mirror } = configure({ remote: [remoteBookmark()] });

			const rows = await mirror.pull();

			expect(rows).toEqual([
				{ lichessId: LICHESS_ID, type: 'hard', createdAt: OLD, updatedAt: OLD, syncedAt: OLD },
			]);
			expect(stored.get(LICHESS_ID)).toEqual(rows[0]);
		});

		it('marks as removed a settled row the account no longer files', async () => {
			const current = settled({ updatedAt: NEW, syncedAt: NEW });
			const { stored, remote, mirror } = configure({ rows: [current] });

			await mirror.pull();

			expect(stored.get(LICHESS_ID)).toEqual({ ...current, removedAt: NEW });
			expect(remote.upsert).not.toHaveBeenCalled();
			expect(remote.remove).not.toHaveBeenCalled();
		});

		it('pushes what this device filed while logged out', async () => {
			const pending = row({ type: 'unclear', history: [event({ type: 'unclear' })] });
			const { remote, mirror } = configure({ rows: [pending] });

			const rows = await mirror.pull();

			expect(remote.upsert).toHaveBeenCalledWith(LICHESS_ID, 'unclear', OLD, 'event-1', undefined);
			expect(rows[0]?.syncedAt).toEqual(OLD);
		});

		it('takes the account version when it moved last', async () => {
			const current = settled({ type: 'easy' });
			const { stored, mirror } = configure({
				rows: [current],
				remote: [remoteBookmark({ type: 'hard', updatedAt: NEW.toISOString() })],
			});

			await mirror.pull();

			expect(stored.get(LICHESS_ID)).toMatchObject({ type: 'hard', updatedAt: NEW });
		});

		it('brings an exercise back when the account kept a filing newer than the removal', async () => {
			const tombstone = row({
				removedAt: OLD,
				history: [event({ type: null })],
			});
			const { stored, mirror } = configure({
				rows: [tombstone],
				remote: [remoteBookmark({ type: 'hard', updatedAt: NEW.toISOString() })],
			});

			await mirror.pull();

			const current = stored.get(LICHESS_ID);

			expect(current).toMatchObject({ type: 'hard', updatedAt: NEW, syncedAt: NEW });
			expect(current?.removedAt).toBeUndefined();
		});

		it('hands back every row, the ones nothing had to be done to included', async () => {
			const current = settled({ type: 'hard' });
			const { mirror } = configure({ rows: [current], remote: [remoteBookmark()] });

			expect(await mirror.pull()).toEqual([current]);
		});
	});

	describe('read', () => {
		it('gives a history to a row saved before there was one, tied to the nearest attempt', async () => {
			const legacy = row({ type: 'hard', updatedAt: NEW });
			const { stored, attempts, mirror } = configure({
				rows: [legacy],
				nearestAttempt: ATTEMPT,
			});

			const [read] = await mirror.read();

			expect(attempts.findNearestBefore).toHaveBeenCalledWith(LICHESS_ID, NEW);
			expect(read?.history).toEqual([
				{ uuid: expect.any(String), type: 'hard', createdAt: NEW, attemptUuid: ATTEMPT },
			]);
			expect(stored.get(LICHESS_ID)).toEqual(read);
		});

		it('leaves alone a row that already has a history', async () => {
			const current = settled();
			const { local, attempts, mirror } = configure({ rows: [current] });

			expect(await mirror.read()).toEqual([current]);
			expect(attempts.findNearestBefore).not.toHaveBeenCalled();
			expect(local.save).not.toHaveBeenCalled();
		});
	});
});

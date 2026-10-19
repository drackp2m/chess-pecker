import type { PuzzleBookmark } from '@chesspecker/api-definitions';
import { describe, expect, it } from 'vitest';

import {
	BookmarkHistoryRow,
	BookmarkRow,
} from '@app/repository/definition/bookmark-schema.interface';
import { adoptRemote, isPending, markSynced, mergeBookmarks } from '@app/util/bookmark-merge';

const OLD = new Date('2026-08-01T10:00:00.000Z');
const NEW = new Date('2026-08-02T10:00:00.000Z');
const NEWER = new Date('2026-08-03T10:00:00.000Z');

function row(over: Partial<BookmarkRow> = {}): BookmarkRow {
	return {
		lichessId: 'abcde',
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

function remote(over: Partial<PuzzleBookmark> = {}): PuzzleBookmark {
	return {
		uuid: 'bookmark-1',
		lichessId: 'abcde',
		type: 'hard',
		createdAt: OLD.toISOString(),
		updatedAt: OLD.toISOString(),
		...over,
	};
}

describe('mergeBookmarks', () => {
	it('pushes a row the account has never seen', () => {
		const { push, save, drop } = mergeBookmarks([row()], []);

		expect(push).toEqual([row()]);
		expect(save).toEqual([]);
		expect(drop).toEqual([]);
	});

	it('drops a row the account no longer files', () => {
		const { drop, push } = mergeBookmarks([row({ syncedAt: OLD })], []);

		expect(drop).toEqual(['abcde']);
		expect(push).toEqual([]);
	});

	it('brings down a row this device does not have', () => {
		const { save } = mergeBookmarks([], [remote()]);

		expect(save).toEqual([
			{ lichessId: 'abcde', type: 'hard', createdAt: OLD, updatedAt: OLD, syncedAt: OLD },
		]);
	});

	it('lets the newer side win', () => {
		const local = row({ type: 'easy', updatedAt: NEW });
		const { push, save } = mergeBookmarks([local], [remote()]);

		expect(push).toEqual([local]);
		expect(save).toEqual([]);
	});

	it('takes the account version when it moved last', () => {
		const local = row({ syncedAt: OLD });
		const { save, push } = mergeBookmarks([local], [remote({ updatedAt: NEW.toISOString() })]);

		expect(save).toEqual([
			{ lichessId: 'abcde', type: 'hard', createdAt: OLD, updatedAt: NEW, syncedAt: NEW },
		]);
		expect(push).toEqual([]);
	});

	it('pushes a removal instead of filing the exercise again', () => {
		const tombstone = row({ syncedAt: OLD, updatedAt: NEW, removedAt: NEW });
		const { push, save } = mergeBookmarks([tombstone], [remote()]);

		expect(push).toEqual([tombstone]);
		expect(save).toEqual([]);
	});

	it('files an exercise again when the account filed it after the removal', () => {
		const tombstone = row({ syncedAt: OLD, updatedAt: OLD, removedAt: OLD });
		const { save, push } = mergeBookmarks([tombstone], [remote({ updatedAt: NEW.toISOString() })]);

		expect(save).toEqual([
			{ lichessId: 'abcde', type: 'hard', createdAt: OLD, updatedAt: NEW, syncedAt: NEW },
		]);
		expect(push).toEqual([]);
	});

	it('pushes a row written at the same instant the account last saw it, if still pending', () => {
		const local = row({ type: 'easy', updatedAt: OLD });
		const { push, save } = mergeBookmarks([local], [remote({ updatedAt: OLD.toISOString() })]);

		expect(push).toEqual([local]);
		expect(save).toEqual([]);
	});

	it('does nothing to a row the account already holds as it is', () => {
		const local = row({ type: 'hard', syncedAt: OLD, history: [event({ syncedAt: OLD })] });

		expect(mergeBookmarks([local], [remote()])).toEqual({ save: [], drop: [], push: [] });
	});

	it('pushes a removal the account never heard of instead of dropping it', () => {
		const tombstone = row({ updatedAt: NEW, removedAt: NEW });
		const { push, drop } = mergeBookmarks([tombstone], []);

		expect(push).toEqual([tombstone]);
		expect(drop).toEqual([]);
	});

	it('drops a removal the account already acknowledged', () => {
		const tombstone = row({ updatedAt: NEW, removedAt: NEW, syncedAt: NEW });
		const { push, drop } = mergeBookmarks([tombstone], []);

		expect(drop).toEqual(['abcde']);
		expect(push).toEqual([]);
	});

	it('pushes a row whose history still holds an event the account never got', () => {
		const local = row({
			syncedAt: OLD,
			history: [event({ syncedAt: OLD }), event({ uuid: 'event-2', createdAt: OLD })],
		});
		const { push } = mergeBookmarks([local], []);

		expect(push).toEqual([local]);
	});

	it('takes the account version but keeps the local history when the account moved last', () => {
		const pending = event({ uuid: 'event-2', type: 'easy', createdAt: NEW });
		const synced = event({ uuid: 'event-1', createdAt: OLD, syncedAt: OLD });
		const local = row({ type: 'easy', updatedAt: NEW, syncedAt: OLD, history: [pending, synced] });
		const { save, push } = mergeBookmarks([local], [remote({ updatedAt: NEWER.toISOString() })]);

		expect(push).toEqual([]);
		expect(save).toHaveLength(1);
		expect(save[0]).toMatchObject({ type: 'hard', updatedAt: NEWER, syncedAt: NEWER });
		expect(save[0]?.history).toEqual([synced, pending]);
	});

	it('settles every exercise on its own', () => {
		const pushed = row({ lichessId: 'pushed', updatedAt: NEW });
		const dropped = row({ lichessId: 'dropped', syncedAt: OLD });
		const replaced = row({ lichessId: 'replaced', syncedAt: OLD });
		const { save, drop, push } = mergeBookmarks(
			[pushed, dropped, replaced],
			[
				remote({ lichessId: 'pushed' }),
				remote({ lichessId: 'replaced', updatedAt: NEW.toISOString() }),
				remote({ lichessId: 'fresh' }),
			],
		);

		expect(push).toEqual([pushed]);
		expect(drop).toEqual(['dropped']);
		expect(save.map((bookmark) => bookmark.lichessId)).toEqual(['replaced', 'fresh']);
	});
});

describe('isPending', () => {
	it('is pending while the account has never acknowledged the row', () => {
		expect(isPending(row())).toBe(true);
	});

	it('is pending once the row moved past what the account acknowledged', () => {
		expect(isPending(row({ syncedAt: OLD, updatedAt: NEW }))).toBe(true);
	});

	it('is pending while an event of its history has not travelled', () => {
		expect(isPending(row({ syncedAt: OLD, history: [event()] }))).toBe(true);
	});

	it('is settled once the row and every event were acknowledged', () => {
		expect(isPending(row({ syncedAt: OLD, history: [event({ syncedAt: OLD })] }))).toBe(false);
	});
});

describe('markSynced', () => {
	it('seals only the event that travelled, as of when it happened', () => {
		const travelled = event({ createdAt: NEW });
		const waiting = event({ uuid: 'event-2', createdAt: NEWER });

		const sealed = markSynced(row({ history: [travelled, waiting] }), travelled);

		expect(sealed.history).toEqual([{ ...travelled, syncedAt: NEW }, waiting]);
	});
});

describe('adoptRemote', () => {
	it('keeps the row when the account answered nothing', () => {
		const local = row({ syncedAt: OLD });

		expect(adoptRemote(local, null)).toBe(local);
	});

	it('keeps the row when the account holds the same version or an older one', () => {
		const local = row({ updatedAt: NEW, syncedAt: NEW });

		expect(adoptRemote(local, remote({ updatedAt: NEW.toISOString() }))).toBe(local);
		expect(adoptRemote(local, remote({ updatedAt: OLD.toISOString() }))).toBe(local);
	});

	it('takes the version the account kept when it is newer, history included', () => {
		const history = [event({ syncedAt: OLD })];
		const local = row({ type: 'easy', removedAt: OLD, syncedAt: OLD, history });

		expect(adoptRemote(local, remote({ updatedAt: NEW.toISOString() }))).toEqual({
			lichessId: 'abcde',
			type: 'hard',
			createdAt: OLD,
			updatedAt: NEW,
			syncedAt: NEW,
			history,
		});
	});
});

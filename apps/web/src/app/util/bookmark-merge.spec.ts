import type { PuzzleBookmark } from '@chesspecker/api-definitions';
import { describe, expect, it } from 'vitest';

import { BookmarkRow } from '@app/repository/definition/bookmark-schema.interface';
import { mergeBookmarks } from '@app/util/bookmark-merge';

const OLD = new Date('2026-08-01T10:00:00.000Z');
const NEW = new Date('2026-08-02T10:00:00.000Z');

function row(over: Partial<BookmarkRow> = {}): BookmarkRow {
	return {
		lichessId: 'abcde',
		type: 'favorite',
		createdAt: OLD,
		updatedAt: OLD,
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
});

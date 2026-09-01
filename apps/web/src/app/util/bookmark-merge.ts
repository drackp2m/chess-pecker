import type { PuzzleBookmark } from '@chesspecker/api-definitions';

import { BookmarkRow } from '@app/repository/definition/bookmark-schema.interface';

/** What the merge decided, in the three moves that carry it out. */
export interface BookmarkMerge {
	/** Rows to write on this device, already sealed with what the server acknowledged. */
	readonly save: readonly BookmarkRow[];
	/** Exercises whose row leaves this device: the server no longer files them. */
	readonly drop: readonly string[];
	/** Rows the server has not caught up with, tombstones included. */
	readonly push: readonly BookmarkRow[];
}

/** A row is behind whenever it has been written since the server last acknowledged it. */
export function isPending(row: BookmarkRow): boolean {
	return undefined === row.syncedAt || row.syncedAt.getTime() < row.updatedAt.getTime();
}

export function fromRemote(bookmark: PuzzleBookmark): BookmarkRow {
	const updatedAt = new Date(bookmark.updatedAt);

	return {
		lichessId: bookmark.lichessId,
		type: bookmark.type,
		createdAt: new Date(bookmark.createdAt),
		updatedAt,
		syncedAt: updatedAt,
	};
}

/**
 * Newest write wins, exercise by exercise. A tombstone is a write like any other, which is
 * what stops the server from filing again what was unfiled here while offline.
 */
export function mergeBookmarks(
	local: readonly BookmarkRow[],
	remote: readonly PuzzleBookmark[],
): BookmarkMerge {
	const server = new Map(remote.map((bookmark) => [bookmark.lichessId, fromRemote(bookmark)]));
	const save: BookmarkRow[] = [];
	const drop: string[] = [];
	const push: BookmarkRow[] = [];

	for (const row of local) {
		const mirrored = server.get(row.lichessId);

		server.delete(row.lichessId);
		settle(row, mirrored, { save, drop, push });
	}

	save.push(...server.values());

	return { save, drop, push };
}

interface Moves {
	readonly save: BookmarkRow[];
	readonly drop: string[];
	readonly push: BookmarkRow[];
}

function settle(row: BookmarkRow, mirrored: BookmarkRow | undefined, moves: Moves): void {
	if (undefined === mirrored) {
		// Never pushed, or pushed and then unfiled elsewhere. Only the first is still work.
		if (isPending(row)) {
			moves.push.push(row);
		} else {
			moves.drop.push(row.lichessId);
		}

		return;
	}

	if (mirrored.updatedAt.getTime() > row.updatedAt.getTime()) {
		moves.save.push(mirrored);

		return;
	}

	if (isPending(row)) {
		moves.push.push(row);
	} else if (undefined !== row.removedAt) {
		// Unfiled here and acknowledged, yet the server still files it: it came back.
		moves.save.push(mirrored);
	}
}

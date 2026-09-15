import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

export interface BookmarkHistoryRow {
	readonly uuid: string;
	readonly type: PuzzleBookmarkType | null;
	readonly attemptUuid?: string;
	readonly createdAt: Date;
	readonly syncedAt?: Date;
}

/**
 * An exercise filed under one list, as this device holds it. A removal leaves the row behind
 * with `removedAt` set: without that tombstone the next pull would file it again.
 */
export interface BookmarkRow {
	readonly lichessId: string;
	readonly type: PuzzleBookmarkType;
	readonly attemptUuid?: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
	/** It was unfiled here. The row is kept only until the server has been told. */
	readonly removedAt?: Date;
	/** The version the server acknowledged. Behind `updatedAt` means there is work to push. */
	readonly syncedAt?: Date;
	readonly history?: readonly BookmarkHistoryRow[];
}

export interface BookmarkSchema extends DBSchema {
	bookmark: {
		key: string;
		value: BookmarkRow;
	};
}

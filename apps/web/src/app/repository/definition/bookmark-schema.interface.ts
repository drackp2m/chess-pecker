import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

/**
 * An exercise filed under one list, as this device holds it. A removal leaves the row behind
 * with `removedAt` set: without that tombstone the next pull would file it again.
 */
export interface BookmarkRow {
	readonly lichessId: string;
	readonly type: PuzzleBookmarkType;
	readonly createdAt: Date;
	readonly updatedAt: Date;
	/** It was unfiled here. The row is kept only until the server has been told. */
	readonly removedAt?: Date;
	/** The version the server acknowledged. Behind `updatedAt` means there is work to push. */
	readonly syncedAt?: Date;
}

export interface BookmarkSchema extends DBSchema {
	bookmark: {
		key: string;
		value: BookmarkRow;
	};
}

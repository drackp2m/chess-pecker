import type { SyncEntity } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

/**
 * How a replica cursor is named: the eight tree tables as the server's summary names them,
 * plus the daily breakdown, the challenges sent and the catalogue, which belong to nobody.
 */
export type SyncCursorKey = SyncEntity | 'catalog' | 'share';

export interface SyncCursorRow {
	readonly key: SyncCursorKey;
	/** How far the download reached: the server stamp, or the page in the catalogue. */
	readonly cursor: string | null;
	/** How many rows were on the other side. A `MAX` cannot see deletions; a count can. */
	readonly count?: number;
	/**
	 * Which version was replicated. Only the catalogue uses it, since its `cursor` is a
	 * `lichessId`; `null` is a replica pulled without a session, which could not ask.
	 */
	readonly version?: string | null;
	/** The sweep finished. Only the catalogue uses it, being pulled whole and by pages. */
	readonly completedAt?: Date | null;
	readonly updatedAt: Date;
}

export interface SyncCursorSchema extends DBSchema {
	syncCursor: {
		key: string;
		value: SyncCursorRow;
	};
}

export interface SyncCursorSchemaV17 extends DBSchema {
	syncCursor: {
		key: string;
		value: Omit<SyncCursorRow, 'key'> & {
			readonly key: SyncEntity | 'activity' | 'catalog' | 'share';
		};
	};
}

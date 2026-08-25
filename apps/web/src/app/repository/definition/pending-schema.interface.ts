import { DBSchema, IDBPObjectStore } from 'idb';

import { LocalRecord } from '@app/repository/definition/local-record.interface';

/**
 * Any syncable row, seen through the only part sync looks at: its key, its stamps and how it
 * names the tree it hangs off.
 */
export interface PendingRow extends LocalRecord {
	readonly uuid: string;
	readonly trainingUuid?: string;
	readonly roundUuid?: string;
	readonly cycleUuid?: string;
}

export interface PendingSchema extends DBSchema {
	row: { key: string; value: PendingRow; indexes: { pendingSince: Date; rejectedAt: Date } };
}

/**
 * `objectStore` is generic and a union of generic signatures cannot be called, so this
 * structural view is what walks the eight tables with one piece of code instead of eight.
 */
export type PendingStore<M extends IDBTransactionMode> = IDBPObjectStore<
	PendingSchema,
	['row'],
	'row',
	M
>;

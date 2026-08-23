import { LocalRecord } from '@app/repository/definition/local-record.interface';

/** A syncable row seen through the only part a push needs: its key. */
export interface SyncableRow extends LocalRecord {
	readonly uuid: string;
}

/**
 * The row was just born here. Its own uuid becomes the `clientRef` the server recognises a
 * retry by, and it starts out pending since it exists nowhere else.
 */
export function born<T extends SyncableRow>(row: T): T {
	return { ...row, clientRef: row.uuid, pendingSince: row.updatedAt };
}

/**
 * The row changes here. `pendingSince` is not refreshed: it says how long it has waited, and
 * a draft flushing every five seconds would leave it forever newly pending.
 */
export function touch<T extends LocalRecord>(row: T, updatedAt = new Date()): T {
	return { ...row, updatedAt, pendingSince: row.pendingSince ?? updatedAt };
}

/**
 * The server has it. Sealing the copy does not modify it, so `updatedAt` stays; what leaves
 * is the pending mark and any earlier refusal.
 */
export function confirmed<T extends LocalRecord>(row: T, syncedAt: Date): T {
	const { pendingSince: _pending, rejectedAt: _at, rejectedReason: _reason, ...kept } = row;

	// An optional mark is removed by dropping the field: `exactOptionalPropertyTypes` refuses
	// `undefined`, and dropping it leaves an `Omit<T, …>` only a cast turns back into `T`.
	return { ...kept, syncedAt } as unknown as T;
}

/**
 * The server will never accept it. It stops being pending, or every boot would retry it
 * forever, but it is not deleted: it shows with its reason on the status screen.
 */
export function rejected<T extends LocalRecord>(
	row: T,
	rejectedAt: Date,
	rejectedReason: string,
): T {
	const { pendingSince: _pending, ...kept } = row;

	return { ...kept, rejectedAt, rejectedReason } as unknown as T;
}

export function requeued<T extends LocalRecord>(row: T, pendingSince = new Date()): T {
	const { rejectedAt: _at, rejectedReason: _reason, ...kept } = row;

	return { ...kept, pendingSince } as unknown as T;
}

/** What the server already refused never travels again, and what hangs off it follows. */
export function isRejected(row: LocalRecord): boolean {
	return undefined !== row.rejectedAt;
}

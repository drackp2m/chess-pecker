import type { SyncEntity } from '@chesspecker/api-definitions';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { PendingStore } from '@app/repository/definition/pending-schema.interface';
import { RepositoryTransaction } from '@app/repository/generic.repository';
import { SyncableRow } from '@app/use-case/sync/local-record';

export type PullTransaction = RepositoryTransaction<AppSchema, 'readwrite'>;

export async function absorbRow(
	transaction: PullTransaction,
	entity: SyncEntity,
	row: SyncableRow | undefined,
): Promise<number> {
	if (undefined === row) {
		return 0;
	}

	const store = transaction.objectStore(entity) as unknown as PendingStore<'readwrite'>;
	const stored = await store.get(row.uuid);

	if (undefined !== stored?.pendingSince) {
		return 0;
	}

	await store.put(row);

	return 1;
}

export async function absorbRows(
	transaction: PullTransaction,
	entity: SyncEntity,
	rows: readonly (SyncableRow | undefined)[],
): Promise<number> {
	let written = 0;

	for (const row of rows) {
		written += await absorbRow(transaction, entity, row);
	}

	return written;
}

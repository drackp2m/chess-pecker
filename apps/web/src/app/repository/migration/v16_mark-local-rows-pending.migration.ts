import { IDBPTransaction, StoreNames } from 'idb';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';
import { PendingStore } from '@app/repository/definition/pending-schema.interface';

type VersionChange = IDBPTransaction<AppSchema, StoreNames<AppSchema>[], 'versionchange'>;

/** The tree's seven. v15 already filled the attempts in, when the index was born. */
const LOCAL_STORES: StoreNames<AppSchema>[] = [
	'training',
	'trainingGoal',
	'calibrationRound',
	'calibrationPuzzle',
	'trainingPuzzle',
	'cycle',
	'cycleItem',
];

/**
 * Everything trained before the push existed lives only here, and a row with no retry key
 * cannot be named, so each takes its own uuid as `clientRef`.
 */
export const markLocalRowsPendingMigration: Migration<AppSchema> = {
	version: 16,
	description: 'give every unsynced training row its retry key and its pending mark',
	apply: async ({ transaction }) => {
		for (const store of LOCAL_STORES) {
			await markPending(transaction, store);
		}
	},
};

async function markPending(transaction: VersionChange, name: StoreNames<AppSchema>): Promise<void> {
	const store = transaction.objectStore(name) as unknown as PendingStore<'versionchange'>;

	for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
		const row = cursor.value;

		if (undefined !== row.syncedAt) {
			continue;
		}

		await cursor.update({
			...row,
			clientRef: row.clientRef ?? row.uuid,
			pendingSince: row.pendingSince ?? row.updatedAt,
		});
	}
}

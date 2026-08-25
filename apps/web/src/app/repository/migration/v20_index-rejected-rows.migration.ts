import { IDBPTransaction, StoreNames } from 'idb';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';
import { PendingStore } from '@app/repository/definition/pending-schema.interface';

type VersionChange = IDBPTransaction<AppSchema, StoreNames<AppSchema>[], 'versionchange'>;

const SYNC_STORES: StoreNames<AppSchema>[] = [
	'training',
	'trainingGoal',
	'calibrationRound',
	'calibrationPuzzle',
	'trainingPuzzle',
	'cycle',
	'cycleItem',
	'attempt',
];

export const indexRejectedRowsMigration: Migration<AppSchema> = {
	version: 20,
	description: 'index the rows the server refused, so logging out can count them',
	apply: ({ transaction }) => {
		for (const name of SYNC_STORES) {
			indexRejected(transaction, name);
		}
	},
};

function indexRejected(transaction: VersionChange, name: StoreNames<AppSchema>): void {
	const store = transaction.objectStore(name) as unknown as PendingStore<'versionchange'>;

	store.createIndex('rejectedAt', 'rejectedAt');
}

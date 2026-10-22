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

export const indexClientRefMigration: Migration<AppSchema> = {
	version: 26,
	description: 'index the uuid each row was born with, so a rekeyed row still answers to it',
	apply: ({ transaction }) => {
		for (const name of SYNC_STORES) {
			indexClientRef(transaction, name);
		}
	},
};

function indexClientRef(transaction: VersionChange, name: StoreNames<AppSchema>): void {
	const store = transaction.objectStore(name) as unknown as PendingStore<'versionchange'>;

	store.createIndex('clientRef', 'clientRef');
}

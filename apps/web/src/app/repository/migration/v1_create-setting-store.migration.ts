import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const createSettingStoreMigration: Migration<AppSchema> = {
	version: 1,
	description: 'create setting store',
	// FixMe => the key path is a random uuid while `type` carries a unique index, so
	// the store enforces one row per type through a constraint instead of through its
	// key. Every write is then a read-modify-write that has to find the existing uuid
	// first, and losing that race (see `SettingStore.add`) aborts the transaction with
	// a `ConstraintError`. Keying on `type` makes `put` an idempotent upsert and the
	// race disappears.
	apply: ({ database }) => {
		const store = database.createObjectStore('setting', { keyPath: 'uuid' });
		store.createIndex('type', 'type', { unique: true });
	},
};

import { Migration } from '@app/repository/definition/migration.interface';
import { SettingSchemaV1 } from '@app/repository/definition/setting-schema.interface';

export const createSettingStoreMigration: Migration<SettingSchemaV1> = {
	version: 1,
	description: 'create setting store',
	apply: ({ database }) => {
		const store = database.createObjectStore('setting', { keyPath: 'uuid' });
		store.createIndex('type', 'type', { unique: true });
	},
};

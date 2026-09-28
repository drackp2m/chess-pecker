import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const createMatchStoreMigration: Migration<AppSchema> = {
	version: 25,
	description: 'create the store that keeps the game against the machine',
	apply: ({ database }) => {
		database.createObjectStore('match', { keyPath: 'id' });
	},
};

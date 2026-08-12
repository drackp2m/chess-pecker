import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const createCatalogCursorStoreMigration: Migration<AppSchema> = {
	version: 10,
	description: 'create the puzzle catalog cursor store',
	apply: ({ database }) => {
		database.createObjectStore('catalogCursor', { keyPath: 'id' });
	},
};

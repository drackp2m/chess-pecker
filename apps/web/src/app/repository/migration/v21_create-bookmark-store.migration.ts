import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const createBookmarkStoreMigration: Migration<AppSchema> = {
	version: 21,
	description: 'create the store that files exercises under a list',
	apply: ({ database }) => {
		database.createObjectStore('bookmark', { keyPath: 'lichessId' });
	},
};

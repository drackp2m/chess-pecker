import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const createShareStoreMigration: Migration<AppSchema> = {
	version: 22,
	description: 'create the store that copies the challenges this account sent',
	apply: ({ database }) => {
		const share = database.createObjectStore('share', { keyPath: 'uuid' });

		share.createIndex('lichessId', 'lichessId');
	},
};

import { AppSchemaV10 } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const createActivityStoreMigration: Migration<AppSchemaV10> = {
	version: 7,
	description: 'create the daily activity store',
	apply: ({ database }) => {
		database.createObjectStore('activityDay', { keyPath: 'date' });
	},
};

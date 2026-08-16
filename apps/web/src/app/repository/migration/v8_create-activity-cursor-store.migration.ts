import { AppSchemaV10 } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const createActivityCursorStoreMigration: Migration<AppSchemaV10> = {
	version: 8,
	description: 'create the activity cursor store',
	apply: ({ database }) => {
		database.createObjectStore('activityCursor', { keyPath: 'id' });
	},
};

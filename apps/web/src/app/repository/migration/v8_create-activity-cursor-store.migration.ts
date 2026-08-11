import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const createActivityCursorStoreMigration: Migration<AppSchema> = {
	version: 8,
	description: 'create the activity cursor store',
	apply: ({ database }) => {
		database.createObjectStore('activityCursor', { keyPath: 'id' });
	},
};

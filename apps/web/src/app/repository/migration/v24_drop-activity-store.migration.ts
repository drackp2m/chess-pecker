import { AppSchemaV17 } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const dropActivityStoreMigration: Migration<AppSchemaV17> = {
	version: 24,
	description: 'drop the obsolete daily activity store',
	apply: async ({ database, transaction }) => {
		await transaction.objectStore('syncCursor').delete('activity');
		database.deleteObjectStore('activityDay');
	},
};

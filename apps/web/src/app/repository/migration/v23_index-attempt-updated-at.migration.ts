import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const indexAttemptUpdatedAtMigration: Migration<AppSchema> = {
	version: 23,
	description: 'index attempts by their completion date for local activity aggregation',
	apply: ({ transaction }) => {
		transaction.objectStore('attempt').createIndex('updatedAt', 'updatedAt');
	},
};

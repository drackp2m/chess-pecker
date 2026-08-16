import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const createAttemptCursorStoreMigration: Migration<AppSchema> = {
	version: 13,
	description: 'create the store that remembers how much history each training has restored',
	apply: ({ database }) => {
		database.createObjectStore('attemptCursor', { keyPath: 'trainingUuid' });
	},
};

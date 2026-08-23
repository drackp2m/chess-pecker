import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

/**
 * Already-restored attempts came in without their place in the pass, which did not travel
 * then. Forgetting the cut brings them back once, which is when the row learns it.
 */
export const resetAttemptCursorMigration: Migration<AppSchema> = {
	version: 14,
	description: 'forget the restore cursor so the history comes back once with its positions',
	apply: async ({ transaction }) => {
		await transaction.objectStore('attemptCursor').clear();
	},
};

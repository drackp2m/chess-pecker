import { AppSchemaV17 } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

/**
 * The daily breakdown renamed its verdicts, and a cached row still carries the old ones.
 * It is a copy of what the server aggregates, so throwing it away and forgetting the cursor
 * costs one download and cannot leave a half-renamed row behind.
 */
export const renameActivityVerdictsMigration: Migration<AppSchemaV17> = {
	version: 18,
	description: 'drop the cached daily breakdown so it comes back with the renamed verdicts',
	apply: async ({ transaction }) => {
		await transaction.objectStore('activityDay').clear();
		await transaction.objectStore('syncCursor').delete('activity');
	},
};

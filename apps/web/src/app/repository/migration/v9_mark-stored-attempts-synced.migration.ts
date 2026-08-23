import { AppSchemaV10 } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

/**
 * Attempts used to go straight to the API on closing, so everything closed locally is
 * already up. Sealing it stops logout warning about an upload queue that does not exist.
 */
export const markStoredAttemptsSyncedMigration: Migration<AppSchemaV10> = {
	version: 9,
	description: 'mark the attempts already sent to the API as synced',
	apply: async ({ transaction }) => {
		const store = transaction.objectStore('attempt');

		for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
			const row = cursor.value;

			if ('open' !== row.closure && undefined === row.syncedAt) {
				await cursor.update({ ...row, syncedAt: row.updatedAt });
			}
		}
	},
};

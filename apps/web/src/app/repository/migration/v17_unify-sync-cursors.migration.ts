import { IDBPDatabase } from 'idb';

import { AppSchema, AppSchemaV16 } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

/**
 * Two differently shaped cursors become one, keyed as the server's summary names each table,
 * so "is there anything new?" reads one store instead of three.
 */
export const unifySyncCursorsMigration: Migration<AppSchemaV16> = {
	version: 17,
	description: 'gather the replica cursors into one store keyed by entity',
	apply: async ({ database, transaction }) => {
		const cursors = (database as unknown as IDBPDatabase<AppSchema>).createObjectStore(
			'syncCursor',
			{ keyPath: 'key' },
		);

		for (const row of await transaction.objectStore('activityCursor').getAll()) {
			await cursors.put({ key: 'activity', cursor: row.cursor, updatedAt: row.updatedAt });
		}

		for (const row of await transaction.objectStore('catalogCursor').getAll()) {
			await cursors.put({
				key: 'catalog',
				cursor: row.cursor,
				count: row.total,
				completedAt: row.completedAt,
				updatedAt: row.updatedAt,
			});
		}

		database.deleteObjectStore('activityCursor');
		database.deleteObjectStore('catalogCursor');
	},
};

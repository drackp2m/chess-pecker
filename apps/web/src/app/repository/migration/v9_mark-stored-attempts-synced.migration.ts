import { AppSchemaV10 } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

/**
 * Hasta ahora un intento se mandaba al API en cuanto se cerraba y no había manera de
 * guardarlo para subirlo luego, así que todo lo cerrado que haya en local ya está arriba.
 * Sellarlo evita que el cierre de sesión avise de una cola de subida que no existe.
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

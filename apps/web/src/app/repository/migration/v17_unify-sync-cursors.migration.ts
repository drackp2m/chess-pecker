import { IDBPDatabase } from 'idb';

import { AppSchema, AppSchemaV16 } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

/**
 * Dos cursores con dos formas distintas pasan a ser uno, clavado por la misma llave con la
 * que el resumen del servidor nombra cada tabla. Así «¿hay algo nuevo?» se contesta leyendo
 * un solo store en vez de tres repartidos.
 *
 * `attemptCursor` no entra: la paginación del histórico es por entrenamiento, así que su
 * clave es el uuid de cada uno y no la entidad.
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

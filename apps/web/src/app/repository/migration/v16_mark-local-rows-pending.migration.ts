import { IDBPTransaction, StoreNames } from 'idb';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';
import { PendingStore } from '@app/repository/definition/pending-schema.interface';

type VersionChange = IDBPTransaction<AppSchema, StoreNames<AppSchema>[], 'versionchange'>;

/** Las siete del árbol. Los intentos ya los rellenó la v15, cuando nació el índice. */
const LOCAL_STORES: StoreNames<AppSchema>[] = [
	'training',
	'trainingGoal',
	'calibrationRound',
	'calibrationPuzzle',
	'trainingPuzzle',
	'cycle',
	'cycleItem',
];

/**
 * Todo lo que se entrenó antes de que existiera la subida está sólo aquí, y sin clave de
 * reintento no se puede ni nombrar: el servidor rechazaría la petición entera por una fila
 * que no sabe decir quién es. Cada fila que nunca llegó arriba se queda con su propio uuid
 * como `clientRef` y con la espera contada desde la última vez que cambió.
 */
export const markLocalRowsPendingMigration: Migration<AppSchema> = {
	version: 16,
	description: 'give every unsynced training row its retry key and its pending mark',
	apply: async ({ transaction }) => {
		for (const store of LOCAL_STORES) {
			await markPending(transaction, store);
		}
	},
};

async function markPending(transaction: VersionChange, name: StoreNames<AppSchema>): Promise<void> {
	const store = transaction.objectStore(name) as unknown as PendingStore<'versionchange'>;

	for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
		const row = cursor.value;

		if (undefined !== row.syncedAt) {
			continue;
		}

		await cursor.update({
			...row,
			clientRef: row.clientRef ?? row.uuid,
			pendingSince: row.pendingSince ?? row.updatedAt,
		});
	}
}

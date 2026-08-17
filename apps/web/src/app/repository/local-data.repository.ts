import { Injectable } from '@angular/core';
import { StoreNames } from 'idb';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { PendingStore } from '@app/repository/definition/pending-schema.interface';
import { SyncCursorKey } from '@app/repository/definition/sync-cursor-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class LocalDataRepository extends GenericRepository<AppSchema> {
	/**
	 * Cuántas filas del entrenamiento no han llegado al servidor. IndexedDB no indexa las
	 * filas a las que les falta el campo, así que el índice de lo pendiente *es* la lista:
	 * contarlo no recorre meses de partidas.
	 */
	async countPendingSync(): Promise<number> {
		return this.runInTransaction(syncStores, 'readonly', async (transaction) => {
			const counts = await Promise.all(
				SYNC_ENTITIES.map((entity) => {
					const store = transaction.objectStore(entity) as unknown as PendingStore<'readonly'>;

					return store.index('pendingSince').count();
				}),
			);

			return counts.reduce((total, count) => total + count, 0);
		});
	}

	/**
	 * Todo lo que es del usuario, en una sola transacción. Fuera quedan `puzzle` —el
	 * catálogo de Lichess, que no es de nadie— y `setting`, que son preferencias del
	 * dispositivo y siguen valiendo sin sesión.
	 *
	 * `syncCursor` no se vacía entero por lo mismo: dentro está también el corte del
	 * catálogo, que sigue sirviendo a quien entre después. Se borran sólo sus llaves.
	 */
	async clearUserData(): Promise<void> {
		await this.runInTransaction(clearedStores, 'readwrite', async (transaction) => {
			await Promise.all(userStores.map((store) => transaction.objectStore(store).clear()));

			const cursors = transaction.objectStore('syncCursor');

			await Promise.all(userCursors.map((key) => cursors.delete(key)));
		});
	}
}

const syncStores: StoreNames<AppSchema>[] = [...SYNC_ENTITIES];

const userCursors: SyncCursorKey[] = [...SYNC_ENTITIES, 'activity'];

const userStores: StoreNames<AppSchema>[] = [
	'activityDay',
	'attempt',
	// El corte de lo ya restaurado se va con los intentos: si sobreviviera, el siguiente
	// usuario del dispositivo pediría sólo lo posterior a un cursor que no es suyo.
	'attemptCursor',
	'attemptDraft',
	'calibrationPuzzle',
	'calibrationRound',
	'cycle',
	'cycleItem',
	'puzzleSet',
	'training',
	'trainingGoal',
	'trainingPuzzle',
];

const clearedStores: StoreNames<AppSchema>[] = [...userStores, 'syncCursor'];

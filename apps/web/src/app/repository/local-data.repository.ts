import { Injectable } from '@angular/core';
import { StoreNames } from 'idb';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class LocalDataRepository extends GenericRepository<AppSchema> {
	/**
	 * Cuántos intentos no han llegado al servidor. IndexedDB no indexa las filas a las que
	 * les falta el campo, así que el índice de lo pendiente *es* la lista: contarlo no
	 * recorre meses de partidas.
	 */
	async countPendingSync(): Promise<number> {
		return this.runInTransaction(['attempt'], 'readonly', (transaction) =>
			transaction.objectStore('attempt').index('pendingSince').count(),
		);
	}

	/**
	 * Todo lo que es del usuario, en una sola transacción. Fuera quedan `puzzle` —el
	 * catálogo de Lichess, que no es de nadie— y `setting`, que son preferencias del
	 * dispositivo y siguen valiendo sin sesión.
	 */
	async clearUserData(): Promise<void> {
		await this.runInTransaction(userStores, 'readwrite', async (transaction) => {
			await Promise.all(userStores.map((store) => transaction.objectStore(store).clear()));
		});
	}
}

const userStores: StoreNames<AppSchema>[] = [
	'activityCursor',
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

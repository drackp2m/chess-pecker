import { Injectable } from '@angular/core';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

@Injectable({
	providedIn: 'root',
})
export class LocalDataRepository extends GenericRepository<AppSchema> {
	/**
	 * Cuántos intentos cerrados no han llegado al servidor. Se recorre con cursor y no con
	 * un `getAll`, que traería meses de partidas a memoria para contar unas pocas.
	 */
	async countPendingSync(): Promise<number> {
		return this.runInTransaction(['attempt'], 'readonly', async (transaction) => {
			const store = transaction.objectStore('attempt');
			let pending = 0;

			for (
				let cursor = await store.openCursor();
				null !== cursor;
				cursor = await cursor.continue()
			) {
				if ('open' !== cursor.value.closure && undefined === cursor.value.syncedAt) {
					pending += 1;
				}
			}

			return pending;
		});
	}

	/**
	 * Todo lo que es del usuario, en una sola transacción. Fuera quedan `puzzle` —el
	 * catálogo de Lichess, que no es de nadie— y `setting`, que son preferencias del
	 * dispositivo y siguen valiendo sin sesión.
	 */
	async clearUserData(): Promise<void> {
		await this.runInTransaction(
			['activityCursor', 'activityDay', 'attempt', 'cycle', 'puzzleSet'],
			'readwrite',
			async (transaction) => {
				await Promise.all([
					transaction.objectStore('activityCursor').clear(),
					transaction.objectStore('activityDay').clear(),
					transaction.objectStore('attempt').clear(),
					transaction.objectStore('cycle').clear(),
					transaction.objectStore('puzzleSet').clear(),
				]);
			},
		);
	}
}

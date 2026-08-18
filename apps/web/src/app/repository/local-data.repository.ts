import { Injectable } from '@angular/core';
import type { SyncEntity } from '@chesspecker/api-definitions';
import { StoreNames } from 'idb';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { PendingStore } from '@app/repository/definition/pending-schema.interface';
import { SyncCursorKey } from '@app/repository/definition/sync-cursor-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';
import { requeued } from '@app/use-case/sync/local-record';

/** Lo que queda por subir, tabla a tabla. */
export type PendingCount = Readonly<Record<SyncEntity, number>>;

export const NO_PENDING: PendingCount = Object.fromEntries(
	SYNC_ENTITIES.map((entity): readonly [SyncEntity, number] => [entity, 0]),
) as PendingCount;

export function sumPending(pending: PendingCount): number {
	return SYNC_ENTITIES.reduce((total, entity) => total + pending[entity], 0);
}

export interface EntityRejection {
	readonly uuid: string;
	readonly rejectedAt: Date;
	readonly reason: string;
}

export interface EntityAudit {
	readonly rows: number;
	readonly pending: number;
	readonly waitingSince: Date | null;
	readonly rejected: number;
	readonly rejections: readonly EntityRejection[];
}

export type SyncAudit = Readonly<Record<SyncEntity, EntityAudit>>;

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
		return sumPending(await this.countPendingByEntity());
	}

	/**
	 * Lo mismo, tabla a tabla. Es el desglose que enseña el splash mientras sube y el que
	 * la pantalla de estado leerá después: ocho recuentos sobre índice cuestan lo mismo
	 * que su suma.
	 */
	async countPendingByEntity(): Promise<PendingCount> {
		return this.runInTransaction(syncStores, 'readonly', async (transaction) => {
			const counts = await Promise.all(
				SYNC_ENTITIES.map(async (entity): Promise<readonly [SyncEntity, number]> => {
					const store = transaction.objectStore(entity) as unknown as PendingStore<'readonly'>;

					return [entity, await store.index('pendingSince').count()];
				}),
			);

			return Object.fromEntries(counts) as PendingCount;
		});
	}

	async auditSync(sampleSize: number): Promise<SyncAudit> {
		return this.runInTransaction(syncStores, 'readonly', async (transaction) => {
			const audits = await Promise.all(
				SYNC_ENTITIES.map(async (entity): Promise<readonly [SyncEntity, EntityAudit]> => {
					const store = transaction.objectStore(entity) as unknown as PendingStore<'readonly'>;

					return [entity, await auditStore(store, sampleSize)];
				}),
			);

			return Object.fromEntries(audits) as SyncAudit;
		});
	}

	async requeueRejected(): Promise<number> {
		const pendingSince = new Date();

		return this.runInTransaction(syncStores, 'readwrite', async (transaction) => {
			let count = 0;

			for (const entity of SYNC_ENTITIES) {
				const store = transaction.objectStore(entity) as unknown as PendingStore<'readwrite'>;

				count += await requeueStore(store, pendingSince);
			}

			return count;
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

async function auditStore(
	store: PendingStore<'readonly'>,
	sampleSize: number,
): Promise<EntityAudit> {
	const pendingIndex = store.index('pendingSince');
	const [rows, pending, waiting] = await Promise.all([
		store.count(),
		pendingIndex.count(),
		pendingIndex.getAll(null, 1),
	]);
	const rejections: EntityRejection[] = [];
	let rejected = 0;

	for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
		const { uuid, rejectedAt, rejectedReason } = cursor.value;

		if (undefined === rejectedAt) {
			continue;
		}

		rejected += 1;

		if (rejections.length < sampleSize) {
			rejections.push({ uuid, rejectedAt, reason: rejectedReason ?? '' });
		}
	}

	return { rows, pending, waitingSince: waiting[0]?.pendingSince ?? null, rejected, rejections };
}

async function requeueStore(store: PendingStore<'readwrite'>, pendingSince: Date): Promise<number> {
	let count = 0;

	for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
		if (undefined === cursor.value.rejectedAt) {
			continue;
		}

		await cursor.update(requeued(cursor.value, pendingSince));
		count += 1;
	}

	return count;
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

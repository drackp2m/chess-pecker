import { Injectable, inject } from '@angular/core';
import type { PushTrainingResult, SyncEntity, SyncRejection } from '@chesspecker/api-definitions';
import { StoreNames } from 'idb';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { PendingRow, PendingStore } from '@app/repository/definition/pending-schema.interface';
import { RepositoryTransaction } from '@app/repository/generic.repository';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { confirmed, rejected } from '@app/use-case/sync/local-record';
import { TrainingTreePush } from '@app/use-case/sync/training-tree.use-case';

export interface SyncConfirmCount {
	readonly confirmed: number;
	readonly rejected: number;
}

type ConfirmStore = PendingStore<'readwrite'>;

type ConfirmTransaction = RepositoryTransaction<AppSchema, 'readwrite'>;

interface Settlement {
	readonly receivedAt: Date;
	readonly uuids: PushTrainingResult['uuids'];
	/** Por `entidad/uuid local`, el motivo por el que el servidor no la quiso. */
	readonly reasons: ReadonlyMap<string, string>;
}

const CONFIRM_STORES: StoreNames<AppSchema>[] = [...SYNC_ENTITIES];

export const NOTHING_SETTLED: SyncConfirmCount = { confirmed: 0, rejected: 0 };

export function addSettled(left: SyncConfirmCount, right: SyncConfirmCount): SyncConfirmCount {
	return {
		confirmed: left.confirmed + right.confirmed,
		rejected: left.rejected + right.rejected,
	};
}

/**
 * Lo que la respuesta de una subida deja escrito aquí: lo que entró queda sellado y deja de
 * estar pendiente, y lo que no va a entrar nunca queda marcado con su motivo para que no se
 * reintente en cada arranque hasta el fin de los tiempos.
 *
 * Va después del reclavado, así que las filas confirmadas ya viven bajo el uuid del
 * servidor; las rechazadas no se movieron y siguen bajo el suyo.
 */
@Injectable({
	providedIn: 'root',
})
export class SyncConfirmUseCase {
	private readonly repository = inject(LocalDataRepository);

	async execute(push: TrainingTreePush, result: PushTrainingResult): Promise<SyncConfirmCount> {
		const settlement: Settlement = {
			receivedAt: new Date(result.receivedAt),
			uuids: result.uuids,
			reasons: toReasons(result.rejected),
		};

		const count = await this.repository.runInTransaction(
			CONFIRM_STORES,
			'readwrite',
			async (transaction) => {
				let settled = NOTHING_SETTLED;

				for (const entity of SYNC_ENTITIES) {
					settled = addSettled(settled, await settleEntity(transaction, entity, push, settlement));
				}

				return settled;
			},
		);

		await this.advanceCursor(push, result);

		return count;
	}

	/**
	 * El servidor devolvió un 4xx sobre el árbol entero: no es un choque de datos sino una
	 * petición que no va a aceptar nunca, así que todo lo que iba dentro deja de reintentarse.
	 */
	async rejectAll(push: TrainingTreePush, reason: string): Promise<SyncConfirmCount> {
		const rejectedAt = new Date();

		return this.repository.runInTransaction(CONFIRM_STORES, 'readwrite', async (transaction) => {
			let count = 0;

			for (const entity of SYNC_ENTITIES) {
				const store = transaction.objectStore(entity) as unknown as ConfirmStore;

				for (const uuid of push.manifest[entity]) {
					count += await settleRow(store, uuid, (row) => rejected(row, rejectedAt, reason));
				}
			}

			return { confirmed: 0, rejected: count };
		});
	}

	/**
	 * El corte del histórico salta a la marca de esta subida, y así la bajada siguiente no se
	 * trae de vuelta lo que acabamos de mandar.
	 */
	private async advanceCursor(push: TrainingTreePush, result: PushTrainingResult): Promise<void> {
		const trainingUuid = result.uuids.training[push.trainingUuid] ?? push.trainingUuid;
		const stored = await this.repository.find('attemptCursor', trainingUuid);

		if (undefined !== stored && stored.cursor >= result.receivedAt) {
			return;
		}

		await this.repository.insert('attemptCursor', {
			trainingUuid,
			cursor: result.receivedAt,
			updatedAt: new Date(),
		});
	}
}

async function settleEntity(
	transaction: ConfirmTransaction,
	entity: SyncEntity,
	push: TrainingTreePush,
	settlement: Settlement,
): Promise<SyncConfirmCount> {
	const store = transaction.objectStore(entity) as unknown as ConfirmStore;
	let settled = NOTHING_SETTLED;

	for (const localUuid of push.manifest[entity]) {
		const reason = settlement.reasons.get(`${entity}/${localUuid}`);

		if (undefined !== reason) {
			const count = await settleRow(store, localUuid, (row) =>
				rejected(row, settlement.receivedAt, reason),
			);

			settled = addSettled(settled, { confirmed: 0, rejected: count });

			continue;
		}

		const uuid = settlement.uuids[entity][localUuid] ?? localUuid;
		const count = await settleRow(store, uuid, (row) => confirmed(row, settlement.receivedAt));

		settled = addSettled(settled, { confirmed: count, rejected: 0 });
	}

	return settled;
}

/** `0` cuando la fila ya no está: otra pestaña pudo llevársela mientras la subida viajaba. */
async function settleRow(
	store: ConfirmStore,
	uuid: string,
	settle: (row: PendingRow) => PendingRow,
): Promise<number> {
	const row = await store.get(uuid);

	if (undefined === row) {
		return 0;
	}

	await store.put(settle(row));

	return 1;
}

function toReasons(rejections: readonly SyncRejection[]): Map<string, string> {
	return new Map(
		rejections.map((rejection) => [`${rejection.entity}/${rejection.clientRef}`, rejection.reason]),
	);
}

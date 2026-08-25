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
	/** By `entity/local uuid`, the reason the server would not take it. */
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
 * What a push response writes back: what landed is sealed, what never will is marked with
 * its reason. It runs after the rekey, so confirmed rows already live under server uuids.
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

		return this.repository.runInTransaction(CONFIRM_STORES, 'readwrite', async (transaction) => {
			let settled = NOTHING_SETTLED;

			for (const entity of SYNC_ENTITIES) {
				settled = addSettled(settled, await settleEntity(transaction, entity, push, settlement));
			}

			return settled;
		});
	}

	/**
	 * A 4xx over the whole tree is not a data clash but a request the server will never take,
	 * so everything inside it stops being retried.
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

/** `0` when the row is gone: another tab may have taken it while the push was in flight. */
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

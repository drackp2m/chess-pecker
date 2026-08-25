import type { SyncEntity } from '@chesspecker/api-definitions';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { PendingRow, PendingStore } from '@app/repository/definition/pending-schema.interface';
import { RepositoryTransaction } from '@app/repository/generic.repository';

export type PendingTransaction = RepositoryTransaction<AppSchema, 'readonly'>;

/**
 * Who a waiting row belongs to. Deals and cycle slots do not name their training: they hang
 * off the round and the cycle, which do, so those are resolved in a second step.
 */
export interface PendingOwners {
	readonly trainings: Set<string>;
	readonly rounds: Set<string>;
	readonly cycles: Set<string>;
}

export function noOwners(): PendingOwners {
	return { trainings: new Set(), rounds: new Set(), cycles: new Set() };
}

/**
 * The trainings with something to push. The pending index *is* the list, since IndexedDB does
 * not index rows missing the field, so this walks nothing else.
 */
export async function pendingTrainings(
	transaction: PendingTransaction,
): Promise<readonly string[]> {
	const owners = noOwners();

	for (const entity of SYNC_ENTITIES) {
		for (const row of await pendingRows(transaction, entity)) {
			collectOwner(entity, row, owners);
		}
	}

	await resolveOwners(transaction, 'calibrationRound', owners.rounds, owners.trainings);
	await resolveOwners(transaction, 'cycle', owners.cycles, owners.trainings);

	return [...owners.trainings];
}

async function pendingRows(
	transaction: PendingTransaction,
	entity: SyncEntity,
): Promise<PendingRow[]> {
	const store = transaction.objectStore(entity) as unknown as PendingStore<'readonly'>;

	return store.index('pendingSince').getAll();
}

function collectOwner(entity: SyncEntity, row: PendingRow, owners: PendingOwners): void {
	if ('training' === entity) {
		owners.trainings.add(row.uuid);

		return;
	}

	if (undefined !== row.trainingUuid) {
		owners.trainings.add(row.trainingUuid);

		return;
	}

	if (undefined !== row.roundUuid) {
		owners.rounds.add(row.roundUuid);

		return;
	}

	if (undefined !== row.cycleUuid) {
		owners.cycles.add(row.cycleUuid);
	}
}

async function resolveOwners(
	transaction: PendingTransaction,
	entity: 'calibrationRound' | 'cycle',
	keys: ReadonlySet<string>,
	trainings: Set<string>,
): Promise<void> {
	const store = transaction.objectStore(entity) as unknown as PendingStore<'readonly'>;

	for (const key of keys) {
		const row = await store.get(key);

		if (undefined !== row?.trainingUuid) {
			trainings.add(row.trainingUuid);
		}
	}
}

import { Injectable, inject } from '@angular/core';
import type { PushTrainingResult, SyncEntity } from '@chesspecker/api-definitions';
import { DBSchema, IDBPObjectStore, StoreNames } from 'idb';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { AttemptDraftRow } from '@app/repository/definition/attempt-draft-schema.interface';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { RepositoryTransaction } from '@app/repository/generic.repository';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { toSlotId } from '@app/use-case/attempt-draft.use-case';

type Remap = Record<SyncEntity, Map<string, string>>;

type RekeyTransaction = RepositoryTransaction<AppSchema, 'readwrite'>;

/** A syncable row seen only by its key, which is all a rekey touches. */
interface RekeyableRow {
	readonly uuid: string;
}

interface RekeyableSchema extends DBSchema {
	row: { key: string; value: RekeyableRow };
}

type RekeyableStore = IDBPObjectStore<RekeyableSchema, ['row'], 'row', 'readwrite'>;

/** The draft is included though it never uploads: its key is the slot, and the slot moves. */
const REKEY_STORES: StoreNames<AppSchema>[] = [...SYNC_ENTITIES, 'attemptDraft'];

/**
 * Rekeys the local tree to the uuids the push returned. A primary key cannot be edited, so
 * this is delete-and-insert in one transaction: a half-rewritten tree is corrupt history.
 */
@Injectable({
	providedIn: 'root',
})
export class RekeyUseCase {
	private readonly repository = inject(LocalDataRepository);

	async execute(trainingUuid: string, uuids: PushTrainingResult['uuids']): Promise<void> {
		const remap = toRemap(uuids);

		if (isEmpty(remap)) {
			return;
		}

		await this.repository.runInTransaction(REKEY_STORES, 'readwrite', async (transaction) => {
			// References first: while the parents keep their old keys, the children are still
			// findable by index.
			await rewriteReferences(transaction, trainingUuid, remap);
			await rekeyRows(transaction, remap);
		});
	}
}

/** The uuid the server returned only matters when it is not the one the row already had. */
function toRemap(uuids: PushTrainingResult['uuids']): Remap {
	const remap: Remap = {
		training: new Map(),
		trainingGoal: new Map(),
		calibrationRound: new Map(),
		calibrationPuzzle: new Map(),
		trainingPuzzle: new Map(),
		cycle: new Map(),
		cycleItem: new Map(),
		attempt: new Map(),
	};

	for (const entity of SYNC_ENTITIES) {
		for (const [clientRef, uuid] of Object.entries(uuids[entity])) {
			if (clientRef !== uuid) {
				remap[entity].set(clientRef, uuid);
			}
		}
	}

	return remap;
}

function isEmpty(remap: Remap): boolean {
	return Object.values(remap).every((assigned) => 0 === assigned.size);
}

async function rewriteReferences(
	transaction: RekeyTransaction,
	trainingUuid: string,
	remap: Remap,
): Promise<void> {
	const trainingRef = remap.training.get(trainingUuid) ?? trainingUuid;

	await rewriteGoals(transaction, trainingUuid, trainingRef);
	await rewriteSet(transaction, trainingUuid, trainingRef);
	await rewriteRounds(transaction, trainingUuid, trainingRef, remap);
	await rewriteCycles(transaction, trainingUuid, trainingRef, remap);
	await rewriteAttempts(transaction, trainingUuid, trainingRef, remap);
	await rewriteDrafts(transaction, trainingUuid, trainingRef, remap);
}

async function rewriteGoals(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
): Promise<void> {
	const store = transaction.objectStore('trainingGoal');

	for (const row of await store.index('trainingUuid').getAll(trainingUuid)) {
		await store.put({ ...row, trainingUuid: trainingRef });
	}
}

async function rewriteSet(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
): Promise<void> {
	const store = transaction.objectStore('trainingPuzzle');

	for (const row of await store.index('trainingUuid').getAll(trainingUuid)) {
		await store.put({ ...row, trainingUuid: trainingRef });
	}
}

async function rewriteRounds(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
	remap: Remap,
): Promise<void> {
	const store = transaction.objectStore('calibrationRound');

	for (const row of await store.index('trainingUuid').getAll(trainingUuid)) {
		await store.put({ ...row, trainingUuid: trainingRef });
		await rewriteDealt(transaction, row.uuid, remap.calibrationRound.get(row.uuid) ?? row.uuid);
	}
}

/** What the round dealt out names it by its key, so it follows it. */
async function rewriteDealt(
	transaction: RekeyTransaction,
	roundUuid: string,
	roundRef: string,
): Promise<void> {
	if (roundRef === roundUuid) {
		return;
	}

	const store = transaction.objectStore('calibrationPuzzle');

	for (const row of await store.index('roundUuid').getAll(roundUuid)) {
		await store.put({ ...row, roundUuid: roundRef });
	}
}

async function rewriteCycles(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
	remap: Remap,
): Promise<void> {
	const store = transaction.objectStore('cycle');

	for (const row of await store.index('trainingUuid').getAll(trainingUuid)) {
		await store.put({ ...row, trainingUuid: trainingRef });
		await rewriteItems(transaction, row.uuid, remap.cycle.get(row.uuid) ?? row.uuid, remap);
	}
}

/** The slot names its cycle and its set exercise, and either may have moved. */
async function rewriteItems(
	transaction: RekeyTransaction,
	cycleUuid: string,
	cycleRef: string,
	remap: Remap,
): Promise<void> {
	const store = transaction.objectStore('cycleItem');

	for (const row of await store.index('cycleUuid').getAll(cycleUuid)) {
		const trainingPuzzleUuid =
			remap.trainingPuzzle.get(row.trainingPuzzleUuid) ?? row.trainingPuzzleUuid;

		await store.put({ ...row, cycleUuid: cycleRef, trainingPuzzleUuid });
	}
}

async function rewriteAttempts(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
	remap: Remap,
): Promise<void> {
	const store = transaction.objectStore('attempt');

	for (const row of await store.index('trainingUuid').getAll(trainingUuid)) {
		await store.put(withAttemptParents(row, trainingRef, remap));
	}
}

/**
 * The draft never uploads, but its primary key *is* the slot it fills: leave it on the old
 * uuid when the slot moves and the half-finished exercise becomes unfindable.
 */
async function rewriteDrafts(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
	remap: Remap,
): Promise<void> {
	const store = transaction.objectStore('attemptDraft');

	for (const row of await store.getAll()) {
		if (row.trainingUuid !== trainingUuid) {
			continue;
		}

		const moved = withDraftParents(row, trainingRef, remap);

		if (moved.slotId !== row.slotId) {
			await store.delete(row.slotId);
		}

		await store.put(moved);
	}
}

function withAttemptParents(row: AttemptRow, trainingUuid: string, remap: Remap): AttemptRow {
	return {
		...row,
		trainingUuid,
		...(undefined === row.roundUuid
			? {}
			: { roundUuid: remap.calibrationRound.get(row.roundUuid) ?? row.roundUuid }),
		...(undefined === row.cycleItemUuid
			? {}
			: { cycleItemUuid: remap.cycleItem.get(row.cycleItemUuid) ?? row.cycleItemUuid }),
	};
}

function withDraftParents(
	row: AttemptDraftRow,
	trainingUuid: string,
	remap: Remap,
): AttemptDraftRow {
	const moved: AttemptDraftRow = {
		...row,
		trainingUuid,
		...(undefined === row.roundUuid
			? {}
			: { roundUuid: remap.calibrationRound.get(row.roundUuid) ?? row.roundUuid }),
		...(undefined === row.cycleItemUuid
			? {}
			: { cycleItemUuid: remap.cycleItem.get(row.cycleItemUuid) ?? row.cycleItemUuid }),
	};

	return { ...moved, slotId: toSlotId(moved) };
}

async function rekeyRows(transaction: RekeyTransaction, remap: Remap): Promise<void> {
	for (const entity of SYNC_ENTITIES) {
		await rekeyStore(transaction, entity, remap[entity]);
	}
}

/**
 * Rekeying needs nothing of a row but its uuid. `objectStore` is generic and a union of
 * generic signatures cannot be called, so a structural view writes this once instead of eight.
 */
async function rekeyStore(
	transaction: RekeyTransaction,
	entity: SyncEntity,
	assigned: Map<string, string>,
): Promise<void> {
	const store = transaction.objectStore(entity) as unknown as RekeyableStore;

	for (const [key, uuid] of assigned) {
		const row = await store.get(key);

		if (undefined !== row) {
			await store.delete(key);
			await store.put({ ...row, uuid });
		}
	}
}

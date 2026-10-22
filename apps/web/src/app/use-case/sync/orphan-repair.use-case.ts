import { Injectable, inject } from '@angular/core';
import type { SyncEntity } from '@chesspecker/api-definitions';
import { IDBPObjectStore, StoreNames } from 'idb';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { AttemptDraftRow } from '@app/repository/definition/attempt-draft-schema.interface';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { PendingStore } from '@app/repository/definition/pending-schema.interface';
import { RepositoryTransaction } from '@app/repository/generic.repository';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { toSlotId } from '@app/use-case/attempt-draft.use-case';
import { currentKey } from '@app/use-case/sync/local-key.use-case';
import { rejected } from '@app/use-case/sync/local-record';

type RepairTransaction = RepositoryTransaction<AppSchema, 'readwrite'>;

type RepairStore<K extends StoreNames<AppSchema>> = IDBPObjectStore<
	AppSchema,
	StoreNames<AppSchema>[],
	K,
	'readwrite'
>;

type ReferenceField =
	'trainingUuid' | 'roundUuid' | 'cycleUuid' | 'trainingPuzzleUuid' | 'cycleItemUuid';

type ReferringRow = Readonly<Partial<Record<ReferenceField, string>>>;

interface Reference {
	readonly field: ReferenceField;
	readonly parent: SyncEntity;
}

interface Slot {
	readonly puzzleUuid: string;
	readonly roundUuid?: string;
	readonly cycleItemUuid?: string;
}

const TRAINING: Reference = { field: 'trainingUuid', parent: 'training' };

const ROUND: Reference = { field: 'roundUuid', parent: 'calibrationRound' };

const CYCLE_ITEM: Reference = { field: 'cycleItemUuid', parent: 'cycleItem' };

const REFERENCES: Readonly<Record<SyncEntity, readonly Reference[]>> = {
	training: [],
	trainingGoal: [TRAINING],
	calibrationRound: [TRAINING],
	calibrationPuzzle: [ROUND],
	trainingPuzzle: [TRAINING],
	cycle: [TRAINING],
	cycleItem: [
		{ field: 'cycleUuid', parent: 'cycle' },
		{ field: 'trainingPuzzleUuid', parent: 'trainingPuzzle' },
	],
	attempt: [TRAINING, ROUND, CYCLE_ITEM],
};

const DRAFT_REFERENCES: readonly Reference[] = [TRAINING, ROUND, CYCLE_ITEM];

const REPAIR_STORES: StoreNames<AppSchema>[] = [...SYNC_ENTITIES, 'attemptDraft'];

@Injectable({
	providedIn: 'root',
})
export class OrphanRepairUseCase {
	private readonly repository = inject(LocalDataRepository);

	async execute(): Promise<number> {
		const rejectedAt = new Date();

		return this.repository.runInTransaction(REPAIR_STORES, 'readwrite', async (transaction) => {
			let repaired = 0;

			for (const entity of SYNC_ENTITIES) {
				repaired +=
					'attempt' === entity
						? await repairAttempts(transaction, rejectedAt)
						: await repairRows(transaction, entity);
			}

			return repaired + (await repairDrafts(transaction));
		});
	}
}

async function repairRows(transaction: RepairTransaction, entity: SyncEntity): Promise<number> {
	const store = transaction.objectStore(entity) as unknown as PendingStore<'readwrite'>;
	let repaired = 0;

	for (const row of await store.index('pendingSince').getAll()) {
		const moved = await reattach(transaction, row, REFERENCES[entity]);

		if (moved !== row) {
			await store.put(moved);
			repaired += 1;
		}
	}

	return repaired;
}

async function repairAttempts(transaction: RepairTransaction, rejectedAt: Date): Promise<number> {
	const store = transaction.objectStore('attempt');
	let repaired = 0;

	for (const row of await store.index('pendingSince').getAll()) {
		const moved = await reattach(transaction, row, REFERENCES.attempt);

		if (moved === row) {
			continue;
		}

		const holder = isSameSlot(row, moved) ? undefined : await slotHolder(store, moved);

		await store.put(
			undefined === holder
				? moved
				: rejected(moved, rejectedAt, `slot already played by \`${holder}\``),
		);
		repaired += 1;
	}

	return repaired;
}

async function repairDrafts(transaction: RepairTransaction): Promise<number> {
	const store = transaction.objectStore('attemptDraft');
	const attempts = transaction.objectStore('attempt');
	let repaired = 0;

	for (const row of await store.getAll()) {
		const moved = await reattach(transaction, row, DRAFT_REFERENCES);

		if (moved === row) {
			continue;
		}

		await store.delete(row.slotId);
		await placeDraft(store, attempts, { ...moved, slotId: toSlotId(moved) });
		repaired += 1;
	}

	return repaired;
}

async function placeDraft(
	store: RepairStore<'attemptDraft'>,
	attempts: RepairStore<'attempt'>,
	draft: AttemptDraftRow,
): Promise<void> {
	if (undefined !== (await slotHolder(attempts, draft))) {
		return;
	}

	const existing = await store.get(draft.slotId);

	if (undefined === existing || existing.updatedAt.getTime() < draft.updatedAt.getTime()) {
		await store.put(draft);
	}
}

async function reattach<T extends ReferringRow>(
	transaction: RepairTransaction,
	row: T,
	references: readonly Reference[],
): Promise<T> {
	let moved = row;

	for (const { field, parent } of references) {
		const uuid: string | undefined = row[field];

		if (undefined === uuid) {
			continue;
		}

		const key = await currentKey(transaction, parent, uuid);

		if (key !== uuid) {
			moved = { ...moved, [field]: key };
		}
	}

	return moved;
}

function isSameSlot(row: AttemptRow, moved: AttemptRow): boolean {
	return row.roundUuid === moved.roundUuid && row.cycleItemUuid === moved.cycleItemUuid;
}

async function slotHolder(
	attempts: RepairStore<'attempt'>,
	slot: Slot,
): Promise<string | undefined> {
	if (undefined !== slot.cycleItemUuid) {
		return attempts.index('cycleItemUuid').getKey(slot.cycleItemUuid);
	}

	if (undefined === slot.roundUuid) {
		return undefined;
	}

	return attempts.index('roundUuid-puzzleUuid').getKey([slot.roundUuid, slot.puzzleUuid]);
}

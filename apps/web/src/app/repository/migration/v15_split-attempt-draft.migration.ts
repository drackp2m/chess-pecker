import { IDBPObjectStore, IDBPTransaction, StoreNames } from 'idb';

import { AppSchema, AppSchemaV14 } from '@app/repository/definition/app-schema.interface';
import { AttemptDraftRow } from '@app/repository/definition/attempt-draft-schema.interface';
import { AttemptRow, AttemptRowV14 } from '@app/repository/definition/attempt-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

type VersionChange = IDBPTransaction<AppSchema, StoreNames<AppSchema>[], 'versionchange'>;

type AttemptStoreV14 = IDBPObjectStore<
	AppSchemaV14,
	StoreNames<AppSchemaV14>[],
	'attempt',
	'versionchange'
>;

/**
 * The draft moves out of the attempt table into its own. `closure: 'open'` was the state
 * invented to fit it, and it leaves with `slotId` and `startedAt`.
 */
export const splitAttemptDraftMigration: Migration<AppSchema> = {
	version: 15,
	description: 'move the open attempt to its own draft store and index what is pending',
	apply: async ({ database, transaction }) => {
		database.createObjectStore('attemptDraft', { keyPath: 'slotId' });

		const attempt = transaction.objectStore('attempt');

		(attempt as unknown as AttemptStoreV14).deleteIndex('slotId');

		await splitStoredAttempts(transaction);

		attempt.createIndex('cycleItemUuid', 'cycleItemUuid');
		attempt.createIndex('roundUuid-puzzleUuid', ['roundUuid', 'puzzleUuid']);
		attempt.createIndex('pendingSince', 'pendingSince');

		indexPendingRows(transaction);
	},
};

/**
 * Pending rows are asked for by index and not by walking the table: IndexedDB does not index
 * rows missing the field, so the index already is the list.
 */
function indexPendingRows(transaction: VersionChange): void {
	transaction.objectStore('training').createIndex('pendingSince', 'pendingSince');
	transaction.objectStore('trainingGoal').createIndex('pendingSince', 'pendingSince');
	transaction.objectStore('calibrationRound').createIndex('pendingSince', 'pendingSince');
	transaction.objectStore('calibrationPuzzle').createIndex('pendingSince', 'pendingSince');
	transaction.objectStore('trainingPuzzle').createIndex('pendingSince', 'pendingSince');
	transaction.objectStore('cycle').createIndex('pendingSince', 'pendingSince');
	transaction.objectStore('cycleItem').createIndex('pendingSince', 'pendingSince');
}

async function splitStoredAttempts(transaction: VersionChange): Promise<void> {
	const store = transaction.objectStore('attempt');
	const drafts = transaction.objectStore('attemptDraft');

	for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
		const row = cursor.value as unknown as AttemptRowV14;

		if ('open' === row.closure) {
			await drafts.put(toDraft(row));
			await cursor.delete();

			continue;
		}

		await cursor.update(toAttempt(row));
	}
}

function toDraft(row: AttemptRowV14): AttemptDraftRow {
	return {
		slotId: row.slotId,
		uuid: row.uuid,
		trainingUuid: row.trainingUuid,
		kind: row.kind,
		puzzleUuid: row.puzzleUuid,
		lichessId: row.lichessId,
		durationMs: row.durationMs,
		record: row.record,
		explorations: row.explorations,
		hintUsed: row.hintUsed,
		mistakeCount: row.mistakeCount,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		...(undefined === row.roundUuid ? {} : { roundUuid: row.roundUuid }),
		...(undefined === row.cycleItemUuid ? {} : { cycleItemUuid: row.cycleItemUuid }),
		...(undefined === row.position ? {} : { position: row.position }),
		...(undefined === row.solved ? {} : { solved: row.solved }),
	};
}

/**
 * A closed row with no verdict is a failure and not a gap, and one that never reached the
 * server stays pending under its own uuid as the retry key.
 */
function toAttempt(row: AttemptRowV14): AttemptRow {
	const { slotId: _slotId, startedAt: _startedAt, ...kept } = row;

	return {
		...kept,
		solved: true === row.solved,
		closure: 'found' === row.closure ? 'found' : 'revealed',
		...(undefined === row.syncedAt ? { clientRef: row.uuid, pendingSince: row.updatedAt } : {}),
	};
}

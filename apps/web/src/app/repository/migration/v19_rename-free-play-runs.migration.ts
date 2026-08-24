import { IDBPTransaction, StoreNames } from 'idb';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

type VersionChange = IDBPTransaction<AppSchema, StoreNames<AppSchema>[], 'versionchange'>;

/** What the row held before free play took its own name back from the calibration round. */
interface RowWithExplorations {
	readonly explorations?: unknown;
	readonly freePlayRuns?: unknown;
}

/**
 * `explorations` becomes `freePlayRuns`, and `scan`/`abandoned` become `exploration` and
 * `cancelled`. A row rewritten here is not pending because of it: the shape changed, not
 * what it says, so `syncedAt` and the retry key are carried over untouched.
 */
export const renameFreePlayRunsMigration: Migration<AppSchema> = {
	version: 19,
	description: 'rename the stored free-play runs, calibration kinds and cancelled statuses',
	apply: async ({ transaction }) => {
		await renameRuns(transaction, 'attempt');
		await renameRuns(transaction, 'attemptDraft');
		await rename(transaction, 'calibrationRound', 'kind', 'scan', 'exploration');
		await rename(transaction, 'training', 'status', 'abandoned', 'cancelled');
		await rename(transaction, 'cycle', 'status', 'abandoned', 'cancelled');
	},
};

async function renameRuns(transaction: VersionChange, name: StoreNames<AppSchema>): Promise<void> {
	const store = transaction.objectStore(name);

	for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
		const { explorations, ...rest } = cursor.value as RowWithExplorations;

		if (undefined === explorations) {
			continue;
		}

		await cursor.update({ ...rest, freePlayRuns: explorations } as never);
	}
}

async function rename(
	transaction: VersionChange,
	name: StoreNames<AppSchema>,
	field: string,
	from: string,
	to: string,
): Promise<void> {
	const store = transaction.objectStore(name);

	for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
		const row = cursor.value as unknown as Record<string, unknown>;

		if (from !== row[field]) {
			continue;
		}

		await cursor.update({ ...row, [field]: to } as never);
	}
}

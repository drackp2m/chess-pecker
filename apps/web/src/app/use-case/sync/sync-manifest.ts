import type { SyncEntity, SyncNode } from '@chesspecker/api-definitions';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { SyncableRow } from '@app/use-case/sync/local-record';

/**
 * Which rows a push expects to confirm, by local uuid. The response can only name those born
 * on this device, so nothing else could seal one that came down and was touched after.
 */
export type SyncManifest = Record<SyncEntity, readonly string[]>;

/**
 * What the tree commits to uploading in this request, on a budget: a veteran account does
 * not fit in one call, and the overflow goes up next pass without duplicating anything.
 */
export class SyncManifestBuilder {
	private readonly rows: Record<SyncEntity, string[]> = {
		training: [],
		trainingGoal: [],
		calibrationRound: [],
		calibrationPuzzle: [],
		trainingPuzzle: [],
		cycle: [],
		cycleItem: [],
		attempt: [],
	};

	private budget: number = SyncPolicy.pushBatchSize;

	/** How many rows have to be confirmed once the server answers. */
	get pending(): number {
		return SYNC_ENTITIES.reduce((total, entity) => total + this.rows[entity].length, 0);
	}

	/**
	 * `false` when the row does not fit, and then nothing hanging off it travels either. A
	 * sealed row spends no budget, travelling only to parent its own, so it always fits.
	 */
	add(entity: SyncEntity, row: SyncableRow): boolean {
		if (undefined === row.pendingSince) {
			return true;
		}

		if (0 === this.budget) {
			return false;
		}

		this.budget -= 1;
		this.rows[entity].push(row.uuid);

		return true;
	}

	build(): SyncManifest {
		return this.rows;
	}
}

/**
 * How a row is named in the tree: the uuid only once it has gone up, since a local one means
 * nothing to the server, and the retry key whenever it has one.
 */
export function syncNode(row: SyncableRow): SyncNode {
	return { ...syncNames(row), ...syncDates(row) };
}

/** What the rows hanging off it, rather than containing it, name it by. */
export function syncRef(row: SyncableRow): string {
	return undefined === row.syncedAt ? (row.clientRef ?? row.uuid) : row.uuid;
}

function syncNames(row: SyncableRow): SyncNode {
	if (undefined === row.syncedAt) {
		return { clientRef: row.clientRef ?? row.uuid };
	}

	return {
		uuid: row.uuid,
		...(undefined === row.clientRef ? {} : { clientRef: row.clientRef }),
	};
}

function syncDates(row: SyncableRow): SyncNode {
	return {
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

import type { PuzzleEvent, SyncEntity, SyncNode } from '@chesspecker/api-definitions';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
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
	private bytes: number = SyncPolicy.pushBatchBytes;

	/** How many rows have to be confirmed once the server answers. */
	get pending(): number {
		return SYNC_ENTITIES.reduce((total, entity) => total + this.rows[entity].length, 0);
	}

	/**
	 * `false` when the row does not fit, and then nothing hanging off it travels either. A
	 * sealed row spends no budget, travelling only to parent its own, so it always fits.
	 */
	add(entity: SyncEntity, row: SyncableRow, weight: number = SyncPolicy.rowBytes): boolean {
		if (undefined === row.pendingSince) {
			return true;
		}

		if (!this.fits(weight)) {
			return false;
		}

		this.budget -= 1;
		this.bytes -= weight;
		this.rows[entity].push(row.uuid);

		return true;
	}

	build(): SyncManifest {
		return this.rows;
	}

	private fits(weight: number): boolean {
		if (0 === this.budget) {
			return false;
		}

		return weight <= this.bytes || SyncPolicy.pushBatchSize === this.budget;
	}
}

export function isWaiting(row: SyncableRow): boolean {
	return undefined === row.rejectedAt && undefined !== row.pendingSince;
}

export function travels(row: SyncableRow, ...children: readonly { length: number }[]): boolean {
	return isWaiting(row) || children.some((group) => 0 < group.length);
}

export function attemptWeight(row: AttemptRow): number {
	let weight = SyncPolicy.rowBytes + eventsWeight(row.record);

	for (const run of row.freePlayRuns) {
		weight += SyncPolicy.rowBytes + eventsWeight(run.events);
	}

	return weight;
}

function eventsWeight(events: readonly PuzzleEvent[]): number {
	let weight = 0;

	for (const event of events) {
		weight += String(event).length + QUOTED;
	}

	return weight;
}

const QUOTED = 3;

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

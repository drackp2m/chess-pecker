import { Injectable, inject } from '@angular/core';
import type { SyncEntity, SyncEntitySummary, SyncSummary } from '@chesspecker/api-definitions';

import { SYNC_ENTITIES, TREE_SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { SYNC_SCHEMA_VERSION } from '@app/definition/sync-schema.constant';
import {
	SyncCursorKey,
	SyncCursorRow,
} from '@app/repository/definition/sync-cursor-schema.interface';
import { SyncCursorRepository } from '@app/repository/sync-cursor.repository';
import { SyncRepository } from '@app/repository/sync.repository';

type StoredCursors = ReadonlyMap<SyncCursorKey, SyncCursorRow>;

export interface SyncStatus {
	readonly summary: SyncSummary;
	/** The server runs a newer model than this one: pull, but never push. */
	readonly canPush: boolean;
	/** The tables whose local cursor has fallen behind the server. */
	readonly behind: readonly SyncEntity[];
	readonly treeCursor: string | undefined;
}

/**
 * What is on the other side against what is here, in one call: the cycle's `checking` phase,
 * which answers what to push and what to pull without asking table by table.
 */
@Injectable({
	providedIn: 'root',
})
export class SyncSummaryUseCase {
	private readonly remote = inject(SyncRepository);
	private readonly cursors = inject(SyncCursorRepository);

	async read(): Promise<SyncStatus> {
		const summary = await this.remote.getSummary();
		const stored: StoredCursors = new Map(
			(await this.cursors.findAllCursors()).map((row) => [row.key, row]),
		);

		return {
			summary,
			canPush: summary.schemaVersion <= SYNC_SCHEMA_VERSION,
			behind: SYNC_ENTITIES.filter((entity) =>
				isBehind(stored.get(entity), summary.entities[entity]),
			),
			treeCursor: toTreeCursor(stored, summary),
		};
	}
}

/**
 * Matching stamp and count means current. Neither alone would do: a `MAX` cannot see a
 * deletion, and a row replaced by another leaves the total unchanged.
 */
function isBehind(local: SyncCursorRow | undefined, remote: SyncEntitySummary): boolean {
	if (null === remote.cursor && 0 === remote.count) {
		return false;
	}

	return (local?.cursor ?? null) !== remote.cursor || (local?.count ?? 0) !== remote.count;
}

function toTreeCursor(stored: StoredCursors, summary: SyncSummary): string | undefined {
	let oldest: string | undefined;

	for (const entity of TREE_SYNC_ENTITIES) {
		if (null === summary.entities[entity].cursor) {
			continue;
		}

		const local = stored.get(entity)?.cursor;

		if (undefined === local || null === local) {
			return undefined;
		}

		oldest = undefined === oldest || local < oldest ? local : oldest;
	}

	return oldest;
}

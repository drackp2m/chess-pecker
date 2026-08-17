import { Injectable, inject } from '@angular/core';
import type { SyncEntity } from '@chesspecker/api-definitions';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { SyncCursorRow } from '@app/repository/definition/sync-cursor-schema.interface';
import {
	EntityAudit,
	EntityRejection,
	LocalDataRepository,
} from '@app/repository/local-data.repository';
import { SyncCursorRepository } from '@app/repository/sync-cursor.repository';

export interface SyncEntityStatus extends EntityAudit {
	readonly entity: SyncEntity;
	readonly cursor: Date | null;
	readonly remoteCount: number | null;
	readonly syncedAt: Date | null;
	readonly isStale: boolean;
}

export interface SyncAuditReport {
	readonly entities: readonly SyncEntityStatus[];
	readonly pending: number;
	readonly rejected: number;
	readonly rejections: readonly (EntityRejection & { readonly entity: SyncEntity })[];
}

@Injectable({
	providedIn: 'root',
})
export class SyncAuditUseCase {
	private readonly localData = inject(LocalDataRepository);
	private readonly cursors = inject(SyncCursorRepository);

	async read(): Promise<SyncAuditReport> {
		const [audit, stored] = await Promise.all([
			this.localData.auditSync(SyncPolicy.rejectionSampleSize),
			this.cursors.findAllCursors(),
		]);
		const rows = new Map(stored.map((row) => [row.key, row]));
		const entities = SYNC_ENTITIES.map((entity) =>
			toStatus(entity, audit[entity], rows.get(entity)),
		);

		return {
			entities,
			pending: entities.reduce((total, entity) => total + entity.pending, 0),
			rejected: entities.reduce((total, entity) => total + entity.rejected, 0),
			rejections: entities.flatMap(({ entity, rejections }) =>
				rejections.map((rejection) => ({ ...rejection, entity })),
			),
		};
	}

	async requeueRejected(): Promise<number> {
		return this.localData.requeueRejected();
	}
}

function toStatus(
	entity: SyncEntity,
	audit: EntityAudit,
	cursor: SyncCursorRow | undefined,
): SyncEntityStatus {
	const waiting = audit.waitingSince;

	return {
		...audit,
		entity,
		cursor: undefined === cursor?.cursor || null === cursor.cursor ? null : new Date(cursor.cursor),
		remoteCount: cursor?.count ?? null,
		syncedAt: cursor?.updatedAt ?? null,
		isStale: null !== waiting && SyncPolicy.staleAfterMs < Date.now() - waiting.getTime(),
	};
}

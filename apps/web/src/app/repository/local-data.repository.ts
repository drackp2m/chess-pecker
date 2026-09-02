import { Injectable } from '@angular/core';
import type { SyncEntity } from '@chesspecker/api-definitions';
import { StoreNames } from 'idb';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { PendingStore } from '@app/repository/definition/pending-schema.interface';
import { SyncCursorKey } from '@app/repository/definition/sync-cursor-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';
import { requeued } from '@app/use-case/sync/local-record';

/** What is left to push, table by table. */
export type PendingCount = Readonly<Record<SyncEntity, number>>;

export const NO_PENDING: PendingCount = Object.fromEntries(
	SYNC_ENTITIES.map((entity): readonly [SyncEntity, number] => [entity, 0]),
) as PendingCount;

export function sumPending(pending: PendingCount): number {
	return SYNC_ENTITIES.reduce((total, entity) => total + pending[entity], 0);
}

/** What a device would lose if it were emptied now: never pushed, or pushed and refused. */
export interface UnsavedCount {
	readonly pending: number;
	readonly rejected: number;
}

export type UnsavedByEntity = Readonly<Record<SyncEntity, UnsavedCount>>;

export const NO_UNSAVED: UnsavedCount = { pending: 0, rejected: 0 };

export function sumUnsaved(unsaved: UnsavedByEntity): UnsavedCount {
	return SYNC_ENTITIES.reduce(
		(total, entity) => ({
			pending: total.pending + unsaved[entity].pending,
			rejected: total.rejected + unsaved[entity].rejected,
		}),
		NO_UNSAVED,
	);
}

export interface EntityRejection {
	readonly uuid: string;
	readonly rejectedAt: Date;
	readonly reason: string;
}

export interface EntityAudit {
	readonly rows: number;
	readonly pending: number;
	readonly waitingSince: Date | null;
	readonly rejected: number;
	readonly rejections: readonly EntityRejection[];
}

export type SyncAudit = Readonly<Record<SyncEntity, EntityAudit>>;

@Injectable({
	providedIn: 'root',
})
export class LocalDataRepository extends GenericRepository<AppSchema> {
	/**
	 * What logging out would delete, table by table: what never reached the server and what
	 * the server refused. A refusal clears `pendingSince`, so counting the pending index
	 * alone reads a device that lost everything as having nothing to lose.
	 */
	async countUnsavedByEntity(): Promise<UnsavedByEntity> {
		return this.runInTransaction(syncStores, 'readonly', async (transaction) => {
			const counts = await Promise.all(
				SYNC_ENTITIES.map(async (entity): Promise<readonly [SyncEntity, UnsavedCount]> => {
					const store = transaction.objectStore(entity) as unknown as PendingStore<'readonly'>;
					const [pending, rejected] = await Promise.all([
						store.index('pendingSince').count(),
						store.index('rejectedAt').count(),
					]);

					return [entity, { pending, rejected }];
				}),
			);

			return Object.fromEntries(counts) as UnsavedByEntity;
		});
	}

	async countUnsavedSync(): Promise<UnsavedCount> {
		return sumUnsaved(await this.countUnsavedByEntity());
	}

	/**
	 * What is left to push, table by table: the breakdown the splash shows while pushing.
	 * Eight counts over an index cost the same as their sum.
	 */
	async countPendingByEntity(): Promise<PendingCount> {
		return this.runInTransaction(syncStores, 'readonly', async (transaction) => {
			const counts = await Promise.all(
				SYNC_ENTITIES.map(async (entity): Promise<readonly [SyncEntity, number]> => {
					const store = transaction.objectStore(entity) as unknown as PendingStore<'readonly'>;

					return [entity, await store.index('pendingSince').count()];
				}),
			);

			return Object.fromEntries(counts) as PendingCount;
		});
	}

	async auditSync(sampleSize: number): Promise<SyncAudit> {
		return this.runInTransaction(syncStores, 'readonly', async (transaction) => {
			const audits = await Promise.all(
				SYNC_ENTITIES.map(async (entity): Promise<readonly [SyncEntity, EntityAudit]> => {
					const store = transaction.objectStore(entity) as unknown as PendingStore<'readonly'>;

					return [entity, await auditStore(store, sampleSize)];
				}),
			);

			return Object.fromEntries(audits) as SyncAudit;
		});
	}

	async requeueRejected(): Promise<number> {
		const pendingSince = new Date();

		return this.runInTransaction(syncStores, 'readwrite', async (transaction) => {
			let count = 0;

			for (const entity of SYNC_ENTITIES) {
				const store = transaction.objectStore(entity) as unknown as PendingStore<'readwrite'>;

				count += await requeueStore(store, pendingSince);
			}

			return count;
		});
	}

	async countPuzzleSets(): Promise<number> {
		return this.runInTransaction(['puzzleSet'], 'readonly', (transaction) =>
			transaction.objectStore('puzzleSet').count(),
		);
	}

	/**
	 * Everything the user owns, in one transaction. `puzzle` and `setting` stay, and only the
	 * user's keys leave `syncCursor`, since the catalogue's cut still serves whoever comes next.
	 */
	async clearUserData(): Promise<void> {
		await this.runInTransaction(clearedStores, 'readwrite', async (transaction) => {
			await Promise.all(userStores.map((store) => transaction.objectStore(store).clear()));

			const cursors = transaction.objectStore('syncCursor');

			await Promise.all(userCursors.map((key) => cursors.delete(key)));
		});
	}
}

async function auditStore(
	store: PendingStore<'readonly'>,
	sampleSize: number,
): Promise<EntityAudit> {
	const pendingIndex = store.index('pendingSince');
	const [rows, pending, waiting] = await Promise.all([
		store.count(),
		pendingIndex.count(),
		pendingIndex.getAll(null, 1),
	]);
	const rejections: EntityRejection[] = [];
	let rejected = 0;

	for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
		const { uuid, rejectedAt, rejectedReason } = cursor.value;

		if (undefined === rejectedAt) {
			continue;
		}

		rejected += 1;

		if (rejections.length < sampleSize) {
			rejections.push({ uuid, rejectedAt, reason: rejectedReason ?? '' });
		}
	}

	return { rows, pending, waitingSince: waiting[0]?.pendingSince ?? null, rejected, rejections };
}

async function requeueStore(store: PendingStore<'readwrite'>, pendingSince: Date): Promise<number> {
	let count = 0;

	for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
		if (undefined === cursor.value.rejectedAt) {
			continue;
		}

		await cursor.update(requeued(cursor.value, pendingSince));
		count += 1;
	}

	return count;
}

const syncStores: StoreNames<AppSchema>[] = [...SYNC_ENTITIES];

const userCursors: SyncCursorKey[] = [...SYNC_ENTITIES, 'share'];

const userStores: StoreNames<AppSchema>[] = [
	'attempt',
	// The restore cut leaves with the attempts: surviving, it would have the next user of
	// the device ask only for what follows a cursor that is not theirs.
	'attemptCursor',
	'attemptDraft',
	'bookmark',
	'calibrationPuzzle',
	'calibrationRound',
	'cycle',
	'cycleItem',
	'puzzleSet',
	'share',
	'training',
	'trainingGoal',
	'trainingPuzzle',
];

const clearedStores: StoreNames<AppSchema>[] = [...userStores, 'syncCursor'];

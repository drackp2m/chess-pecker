import type { SyncEntity, SyncNodeParsed } from '@chesspecker/api-definitions';
import { EntityManager, EntityName, FilterQuery } from '@mikro-orm/core';


import { syncKey } from './sync-node.util';

export interface SyncRow {
	uuid: string;
	clientRef?: string;
}

export interface SyncKeys {
	readonly uuids: string[];
	readonly clientRefs: string[];
}

export function noKeys(): SyncKeys {
	return { uuids: [], clientRefs: [] };
}

export function collectKey(keys: SyncKeys, node: SyncNodeParsed): void {
	if (undefined !== node.uuid) {
		keys.uuids.push(node.uuid);
	}

	if (undefined !== node.clientRef) {
		keys.clientRefs.push(node.clientRef);
	}
}

export class SyncRowIndex<T extends SyncRow> {
	private readonly byUuid = new Map<string, T>();
	private readonly byClientRef = new Map<string, T>();

	constructor(rows: readonly T[]) {
		for (const row of rows) {
			this.byUuid.set(row.uuid, row);

			if (undefined !== row.clientRef) {
				this.byClientRef.set(row.clientRef, row);
			}
		}
	}

	find(node: SyncNodeParsed, entity: SyncEntity): T | undefined {
		const key = syncKey(node, entity);

		return 'uuid' in key ? this.byUuid.get(key.uuid) : this.byClientRef.get(key.clientRef);
	}
}

export async function loadRowIndex<T extends SyncRow>(
	entityManager: EntityManager,
	entity: EntityName<T>,
	keys: SyncKeys,
): Promise<SyncRowIndex<T>> {
	const conditions: FilterQuery<SyncRow>[] = [];

	if (0 < keys.uuids.length) {
		conditions.push({ uuid: { $in: keys.uuids } });
	}

	if (0 < keys.clientRefs.length) {
		conditions.push({ clientRef: { $in: keys.clientRefs } });
	}

	if (0 === conditions.length) {
		return new SyncRowIndex<T>([]);
	}

	const where = { $or: conditions } as unknown as FilterQuery<T>;

	const rows = await entityManager.find(entity, where);

	return new SyncRowIndex(rows);
}

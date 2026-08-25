import { Injectable } from '@angular/core';

import {
	SyncCursorKey,
	SyncCursorRow,
	SyncCursorSchema,
} from '@app/repository/definition/sync-cursor-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

export type SyncCursorState = Omit<SyncCursorRow, 'key' | 'updatedAt'>;

/**
 * How far the replica reaches, table by table. It is what `GET /sync` is checked against to
 * know what to pull without asking training by training.
 */
@Injectable({
	providedIn: 'root',
})
export class SyncCursorRepository extends GenericRepository<SyncCursorSchema> {
	async findCursor(key: SyncCursorKey): Promise<SyncCursorRow | undefined> {
		return this.find('syncCursor', key);
	}

	async findAllCursors(): Promise<SyncCursorRow[]> {
		return this.findAll('syncCursor');
	}

	async saveCursor(key: SyncCursorKey, state: SyncCursorState): Promise<void> {
		await this.insert('syncCursor', { ...state, key, updatedAt: new Date() });
	}
}

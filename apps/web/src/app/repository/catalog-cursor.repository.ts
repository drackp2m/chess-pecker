import { Injectable, inject } from '@angular/core';

import { SyncCursorRepository } from '@app/repository/sync-cursor.repository';

export interface CatalogCursorState {
	/** The last page served, or `null` when there is nothing left to ask for. */
	readonly cursor: string | null;
	readonly total: number;
	/** The version the summary reported when the sweep began, or `null` if it could not ask. */
	readonly version: string | null;
	readonly completedAt: Date | null;
}

/**
 * Where the catalogue download stands. Since v17 the row lives in `syncCursor` like any
 * other; this only gives it the name the sweep uses.
 */
@Injectable({
	providedIn: 'root',
})
export class CatalogCursorRepository {
	private readonly cursors = inject(SyncCursorRepository);

	async findState(): Promise<CatalogCursorState | undefined> {
		const row = await this.cursors.findCursor('catalog');

		if (undefined === row) {
			return undefined;
		}

		return {
			cursor: row.cursor,
			total: row.count ?? 0,
			version: row.version ?? null,
			completedAt: row.completedAt ?? null,
		};
	}

	async saveState(state: CatalogCursorState): Promise<void> {
		await this.cursors.saveCursor('catalog', {
			cursor: state.cursor,
			count: state.total,
			version: state.version,
			completedAt: state.completedAt,
		});
	}
}

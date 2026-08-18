import { Injectable, inject } from '@angular/core';

import { SyncCursorRepository } from '@app/repository/sync-cursor.repository';

export interface CatalogCursorState {
	/** La última página servida, o `null` cuando no queda nada por pedir. */
	readonly cursor: string | null;
	readonly total: number;
	/** La versión que decía el resumen al empezar la barrida, o `null` si no se pudo pedir. */
	readonly version: string | null;
	readonly completedAt: Date | null;
}

/**
 * Por dónde va la bajada del catálogo. Desde la v17 la fila vive en `syncCursor` como una
 * más; aquí sólo se le pone el nombre que usa la barrida, que es la que la lee y la escribe.
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

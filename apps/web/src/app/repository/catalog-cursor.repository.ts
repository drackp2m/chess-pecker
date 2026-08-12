import { Injectable } from '@angular/core';

import {
	CATALOG_CURSOR_KEY,
	CatalogCursorRow,
	CatalogCursorSchema,
} from '@app/repository/definition/catalog-cursor-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';

export type CatalogCursorState = Omit<CatalogCursorRow, 'id' | 'updatedAt'>;

@Injectable({
	providedIn: 'root',
})
export class CatalogCursorRepository extends GenericRepository<CatalogCursorSchema> {
	async findState(): Promise<CatalogCursorRow | undefined> {
		return this.find('catalogCursor', CATALOG_CURSOR_KEY);
	}

	async saveState(state: CatalogCursorState): Promise<void> {
		await this.insert('catalogCursor', {
			...state,
			id: CATALOG_CURSOR_KEY,
			updatedAt: new Date(),
		});
	}
}

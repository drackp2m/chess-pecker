import { DBSchema } from 'idb';

export const CATALOG_CURSOR_KEY = 'puzzle-catalog';

export interface CatalogCursorRow {
	readonly id: typeof CATALOG_CURSOR_KEY;
	readonly cursor: string | null;
	readonly total: number;
	readonly completedAt: Date | null;
	readonly updatedAt: Date;
}

export interface CatalogCursorSchema extends DBSchema {
	catalogCursor: {
		key: string;
		value: CatalogCursorRow;
	};
}

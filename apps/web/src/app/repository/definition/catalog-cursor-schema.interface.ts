import { DBSchema } from 'idb';

/**
 * Where the catalogue download stood. Frozen: since v17 this row lives in `syncCursor` under
 * the `catalog` key, and its `total` is the `count` there.
 */
export interface CatalogCursorRowV16 {
	readonly id: 'puzzle-catalog';
	readonly cursor: string | null;
	readonly total: number;
	readonly completedAt: Date | null;
	readonly updatedAt: Date;
}

export interface CatalogCursorSchemaV16 extends DBSchema {
	catalogCursor: {
		key: string;
		value: CatalogCursorRowV16;
	};
}

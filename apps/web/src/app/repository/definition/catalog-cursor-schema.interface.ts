import { DBSchema } from 'idb';

/**
 * Por dónde iba la bajada del catálogo. Congelada: desde la v17 esta fila vive en
 * `syncCursor`, con la llave `catalog`, y su `total` es el `count` de allí.
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

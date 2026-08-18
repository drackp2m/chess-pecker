import type { SyncEntity } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

/**
 * Con qué se nombra un cursor de la réplica. Las ocho tablas del árbol se llaman igual que
 * en el resumen del servidor, y a su lado van los dos que no son del árbol: el desglose
 * diario, que es un agregado, y el catálogo, que es global y no es de nadie.
 *
 * `attemptCursor` no está aquí: la paginación del histórico es por entrenamiento y tiene su
 * propio store, clavado por el uuid de cada uno.
 */
export type SyncCursorKey = SyncEntity | 'activity' | 'catalog';

export interface SyncCursorRow {
	readonly key: SyncCursorKey;
	/** Hasta dónde se ha bajado: la marca del servidor, o la página en el catálogo. */
	readonly cursor: string | null;
	/** Cuántas filas había del otro lado. Un `MAX` no ve los borrados; el recuento sí. */
	readonly count?: number;
	/**
	 * De qué versión es lo replicado. Sólo lo usa el catálogo: su `cursor` es la última
	 * página servida —un `lichessId`—, así que la marca del servidor no tiene otro hueco
	 * donde vivir. `null` es una réplica bajada sin sesión, que no pudo preguntarla.
	 */
	readonly version?: string | null;
	/** La barrida terminó. Sólo lo usa el catálogo, que se baja entero y por páginas. */
	readonly completedAt?: Date | null;
	readonly updatedAt: Date;
}

export interface SyncCursorSchema extends DBSchema {
	syncCursor: {
		key: string;
		value: SyncCursorRow;
	};
}

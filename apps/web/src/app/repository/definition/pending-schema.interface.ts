import { DBSchema, IDBPObjectStore } from 'idb';

import { LocalRecord } from '@app/repository/definition/local-record.interface';

/**
 * Una fila sincronizable cualquiera, vista por lo único que la sincronización mira de ella:
 * su clave, sus marcas y con qué nombra al árbol del que cuelga —cada tabla lleva una de las
 * tres—.
 */
export interface PendingRow extends LocalRecord {
	readonly uuid: string;
	readonly trainingUuid?: string;
	readonly roundUuid?: string;
	readonly cycleUuid?: string;
}

export interface PendingSchema extends DBSchema {
	row: { key: string; value: PendingRow; indexes: { pendingSince: Date } };
}

/**
 * `objectStore` es genérico y una unión de firmas genéricas no se puede llamar, así que la
 * vista estructural es lo que permite recorrer las ocho tablas con un solo trozo de código en
 * vez de con ocho copias.
 */
export type PendingStore<M extends IDBTransactionMode> = IDBPObjectStore<
	PendingSchema,
	['row'],
	'row',
	M
>;

import { LocalRecord } from '@app/repository/definition/local-record.interface';

/** Una fila sincronizable vista por lo único que la subida necesita de ella: su clave. */
export interface SyncableRow extends LocalRecord {
	readonly uuid: string;
}

/**
 * La fila acaba de nacer aquí. Su propio uuid queda como `clientRef`, que es la clave con la
 * que el servidor reconocerá un reintento de la misma subida, y como todavía no existe en
 * ningún otro sitio nace pendiente.
 */
export function born<T extends SyncableRow>(row: T): T {
	return { ...row, clientRef: row.uuid, pendingSince: row.updatedAt };
}

/**
 * La fila cambia aquí. `pendingSince` no se refresca: lo que dice es desde cuándo espera, y
 * un borrador que se vuelca cada cinco segundos la dejaría eternamente recién pendiente.
 */
export function touch<T extends LocalRecord>(row: T, updatedAt = new Date()): T {
	return { ...row, updatedAt, pendingSince: row.pendingSince ?? updatedAt };
}

/**
 * El servidor ya la tiene. Sellar la copia no la modifica, así que `updatedAt` se queda como
 * estaba; lo que se va es la marca de espera y cualquier rechazo anterior, que ya no describe
 * a esta fila.
 */
export function confirmed<T extends LocalRecord>(row: T, syncedAt: Date): T {
	const { pendingSince: _pending, rejectedAt: _at, rejectedReason: _reason, ...kept } = row;

	// Una marca opcional se quita quitando el campo: con `exactOptionalPropertyTypes` no se le
	// puede asignar `undefined`. Y quitarlo deja un `Omit<T, …>` que sólo vuelve a ser `T` por
	// conversión.
	return { ...kept, syncedAt } as unknown as T;
}

/**
 * El servidor no la va a aceptar nunca. Deja de estar pendiente —si no, se reintentaría en
 * cada arranque hasta el fin de los tiempos— pero no se borra: sale con su motivo en la
 * pantalla de estado.
 */
export function rejected<T extends LocalRecord>(
	row: T,
	rejectedAt: Date,
	rejectedReason: string,
): T {
	const { pendingSince: _pending, ...kept } = row;

	return { ...kept, rejectedAt, rejectedReason } as unknown as T;
}

export function requeued<T extends LocalRecord>(row: T, pendingSince = new Date()): T {
	const { rejectedAt: _at, rejectedReason: _reason, ...kept } = row;

	return { ...kept, pendingSince } as unknown as T;
}

/** Lo que el servidor ya rechazó no vuelve a viajar, y lo que cuelga de ello se va detrás. */
export function isRejected(row: LocalRecord): boolean {
	return undefined !== row.rejectedAt;
}

import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

import { LocalRecord } from '@app/repository/definition/local-record.interface';

/**
 * Un día ya agregado, tal cual lo sirve el API. La clave es la fecha `YYYY-MM-DD`, que
 * ordena igual como texto que como fecha, así que los rangos salen del propio índice
 * primario. `updatedAt` es cuándo se pidió, no cuándo se entrenó.
 */
export interface ActivityDayRow extends LocalRecord, TrainingActivityDay {}

/**
 * Hasta dónde llegaba el servidor la última vez que se preguntó. Congelada: desde la v17
 * esta fila vive en `syncCursor`, con la llave `activity` y junto a las demás.
 */
export interface ActivityCursorRowV16 {
	readonly id: 'training-activity';
	readonly cursor: string;
	readonly updatedAt: Date;
}

export interface ActivitySchema extends DBSchema {
	activityDay: {
		key: string;
		value: ActivityDayRow;
	};
}

export interface ActivityCursorSchemaV16 extends DBSchema {
	activityCursor: {
		key: string;
		value: ActivityCursorRowV16;
	};
}

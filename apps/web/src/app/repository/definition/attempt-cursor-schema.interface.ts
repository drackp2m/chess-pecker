import { DBSchema } from 'idb';

/**
 * Hasta dónde llegaba el servidor la última vez que se bajó el histórico de un
 * entrenamiento. Sin esta fila la restauración empieza por el principio, que es justo lo
 * que necesita un dispositivo recién vaciado.
 */
export interface AttemptCursorRow {
	readonly trainingUuid: string;
	readonly cursor: string;
	readonly updatedAt: Date;
}

export interface AttemptCursorSchema extends DBSchema {
	attemptCursor: {
		key: string;
		value: AttemptCursorRow;
	};
}

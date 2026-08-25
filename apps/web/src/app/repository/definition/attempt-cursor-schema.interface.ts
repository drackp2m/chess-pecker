import { DBSchema } from 'idb';

/**
 * How far the server reached the last time a training's history was pulled. Without this
 * row the restore starts from the beginning, which is what an emptied device needs.
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

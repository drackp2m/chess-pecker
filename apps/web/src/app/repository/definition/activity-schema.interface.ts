import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

import { LocalRecord } from '@app/repository/definition/local-record.interface';

/**
 * One aggregated day as the API serves it, keyed by `YYYY-MM-DD` so ranges come off the
 * primary index. `updatedAt` is when it was asked for, not when it was trained.
 */
export interface ActivityDayRow extends LocalRecord, TrainingActivityDay {}

/**
 * How far the server reached the last time it was asked. Frozen: since v17 this row lives
 * in `syncCursor` under the `activity` key.
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

import type { TrainingCycleStatus } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

import { LocalRecord } from '@app/repository/definition/local-record.interface';

export interface CycleRow extends LocalRecord {
	readonly uuid: string;
	readonly setId: string;
	readonly index: number;
	readonly status: TrainingCycleStatus;
	readonly lichessIds: readonly string[];
}

export interface CycleSchema extends DBSchema {
	cycle: {
		key: string;
		value: CycleRow;
		indexes: { setId: string };
	};
}

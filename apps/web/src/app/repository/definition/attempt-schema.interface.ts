import { DBSchema } from 'idb';

import { LocalRecord } from '@app/repository/definition/local-record.interface';

export interface AttemptRow extends LocalRecord {
	readonly uuid: string;
	readonly setId: string;
	readonly cycleId: string;
	readonly lichessId: string;
	readonly startedAt: Date;
	readonly durationMs: number;
	readonly movesPlayed: number;
	readonly solved?: boolean;
}

export interface AttemptSchema extends DBSchema {
	attempt: {
		key: string;
		value: AttemptRow;
		indexes: {
			cycleId: string;
			'lichessId-cycleId': [string, string];
		};
	};
}

import type { PuzzleAttemptKind } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

import { LocalRecord } from '@app/repository/definition/local-record.interface';

export interface AttemptRow extends LocalRecord {
	readonly uuid: string;
	readonly trainingUuid: string;
	readonly kind: PuzzleAttemptKind;
	readonly slotId: string;
	readonly roundUuid?: string;
	readonly cycleItemUuid?: string;
	readonly puzzleUuid: string;
	readonly lichessId: string;
	readonly startedAt?: Date;
	readonly durationMs: number;
	readonly movesPlayed: number;
	readonly solved?: boolean;
}

export interface AttemptSchema extends DBSchema {
	attempt: {
		key: string;
		value: AttemptRow;
		indexes: {
			slotId: string;
			trainingUuid: string;
		};
	};
}

export interface AttemptRowV3 extends LocalRecord {
	readonly uuid: string;
	readonly setId: string;
	readonly cycleId: string;
	readonly lichessId: string;
	readonly startedAt: Date;
	readonly durationMs: number;
	readonly movesPlayed: number;
	readonly solved?: boolean;
}

export interface AttemptSchemaV3 extends DBSchema {
	attempt: {
		key: string;
		value: AttemptRowV3;
		indexes: {
			cycleId: string;
			'lichessId-cycleId': [string, string];
		};
	};
}

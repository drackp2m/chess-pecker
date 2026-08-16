import type { ApiPuzzle } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

import { LocalRecord } from '@app/repository/definition/local-record.interface';

export interface PuzzleRow extends Omit<ApiPuzzle, 'uuid'>, LocalRecord {
	readonly uuid?: string;
}

export interface PuzzleSchema extends DBSchema {
	puzzle: {
		key: string;
		value: PuzzleRow;
		indexes: { uuid: string; rating: number };
	};
}

export interface PuzzleSchemaV10 extends DBSchema {
	puzzle: {
		key: string;
		value: PuzzleRow;
		indexes: { uuid: string };
	};
}

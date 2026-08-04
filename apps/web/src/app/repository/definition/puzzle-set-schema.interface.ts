import { DBSchema } from 'idb';

import { LocalRecord } from '@app/repository/definition/local-record.interface';

export interface PuzzleSetRow extends LocalRecord {
	readonly uuid: string;
	readonly name: string;
	readonly lichessIds: readonly string[];
}

export interface PuzzleSetSchema extends DBSchema {
	puzzleSet: {
		key: string;
		value: PuzzleSetRow;
	};
}

import type { PuzzleAttemptKind } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

import { PieceColor } from '@app/definition/chess.type';
import { FreePlayRun, PuzzleClosure, PuzzleEvent } from '@app/definition/puzzle.type';
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
	/** Everything that happened outside free play, in order. */
	readonly record: readonly PuzzleEvent[];
	/** Every visit to free play, anchored to a length of `record`. */
	readonly explorations: readonly FreePlayRun[];
	/**
	 * Which colour was at the bottom when the verdict settled. It is the one thing the
	 * record cannot give back —flipping the board is not something that happens to the
	 * board's position— and it is absent on rows written before v5.
	 */
	readonly orientation?: PieceColor;
	/** The verdict, sealed on the first try, or absent while there is none yet. */
	readonly solved?: boolean;
	/** Whether the exercise is over, which is what reopening it looks at. */
	readonly closure: PuzzleClosure;
	readonly hintUsed: boolean;
	readonly mistakeCount: number;
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

export interface AttemptRowV5 extends LocalRecord {
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
	readonly record: readonly PuzzleEvent[];
	readonly explorations: readonly FreePlayRun[];
	readonly orientation?: PieceColor;
	readonly solved?: boolean;
}

export interface AttemptSchemaV5 extends DBSchema {
	attempt: {
		key: string;
		value: AttemptRowV5;
		indexes: {
			slotId: string;
			trainingUuid: string;
		};
	};
}

export interface AttemptRowV4 extends LocalRecord {
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

export interface AttemptSchemaV4 extends DBSchema {
	attempt: {
		key: string;
		value: AttemptRowV4;
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

import type { PuzzleAttemptClosure, PuzzleAttemptKind } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

import { PieceColor } from '@app/definition/chess.type';
import { FreePlayRun, PuzzleClosure, PuzzleEvent } from '@app/definition/puzzle.type';
import { LocalRecord } from '@app/repository/definition/local-record.interface';

/** Un ejercicio terminado. Espejo exacto de `puzzle_attempt`, y append-only como allí. */
export interface AttemptRow extends LocalRecord {
	readonly uuid: string;
	readonly trainingUuid: string;
	readonly kind: PuzzleAttemptKind;
	readonly roundUuid?: string;
	readonly cycleItemUuid?: string;
	/**
	 * Its place inside the pass, from 0. It travels on the row because the plan it belongs
	 * to may not be here: a restored device only knows the slots it was served.
	 */
	readonly position?: number;
	readonly puzzleUuid: string;
	readonly lichessId: string;
	readonly durationMs: number;
	/** Everything that happened outside free play, in order. */
	readonly record: readonly PuzzleEvent[];
	/** Every visit to free play, anchored to a length of `record`. */
	readonly explorations: readonly FreePlayRun[];
	readonly solved: boolean;
	/** Cómo acabó el ejercicio. Una fila aquí está cerrada por definición. */
	readonly closure: PuzzleAttemptClosure;
	readonly hintUsed: boolean;
	readonly mistakeCount: number;
}

export interface AttemptSchema extends DBSchema {
	attempt: {
		key: string;
		value: AttemptRow;
		indexes: {
			trainingUuid: string;
			cycleItemUuid: string;
			'roundUuid-puzzleUuid': [string, string];
			pendingSince: Date;
		};
	};
}

export interface AttemptRowV14 extends LocalRecord {
	readonly uuid: string;
	readonly trainingUuid: string;
	readonly kind: PuzzleAttemptKind;
	readonly slotId: string;
	readonly roundUuid?: string;
	readonly cycleItemUuid?: string;
	readonly position?: number;
	readonly puzzleUuid: string;
	readonly lichessId: string;
	readonly startedAt?: Date;
	readonly durationMs: number;
	readonly record: readonly PuzzleEvent[];
	readonly explorations: readonly FreePlayRun[];
	readonly solved?: boolean;
	readonly closure: PuzzleClosure;
	readonly hintUsed: boolean;
	readonly mistakeCount: number;
}

export interface AttemptSchemaV14 extends DBSchema {
	attempt: {
		key: string;
		value: AttemptRowV14;
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

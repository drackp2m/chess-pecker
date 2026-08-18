import type { PuzzleAttemptKind } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

import { FreePlayRun, PuzzleEvent } from '@app/definition/puzzle.type';

/** El ejercicio a medias: sólo vive aquí, nunca sube, y se borra al sellarse. */
export interface AttemptDraftRow {
	readonly slotId: string;
	/** El que llevará el intento al sellarse. */
	readonly uuid: string;
	readonly trainingUuid: string;
	readonly kind: PuzzleAttemptKind;
	readonly roundUuid?: string;
	readonly cycleItemUuid?: string;
	readonly position?: number;
	readonly puzzleUuid: string;
	readonly lichessId: string;
	readonly durationMs: number;
	readonly record: readonly PuzzleEvent[];
	readonly explorations: readonly FreePlayRun[];
	/** Aún puede no haber veredicto. */
	readonly solved?: boolean;
	readonly hintUsed: boolean;
	readonly mistakeCount: number;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export interface AttemptDraftSchema extends DBSchema {
	attemptDraft: {
		key: string;
		value: AttemptDraftRow;
	};
}

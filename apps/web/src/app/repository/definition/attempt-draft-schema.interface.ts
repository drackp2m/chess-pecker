import type { PuzzleAttemptKind } from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

import { FreePlayRun, PuzzleEvent } from '@app/definition/puzzle.type';

/** The half-finished exercise: it lives only here, never uploads, and goes on sealing. */
export interface AttemptDraftRow {
	readonly slotId: string;
	/** The one the attempt will carry once sealed. */
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
	readonly freePlayRuns: readonly FreePlayRun[];
	/** There may still be no verdict. */
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

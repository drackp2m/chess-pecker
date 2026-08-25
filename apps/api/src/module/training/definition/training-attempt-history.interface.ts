import type { FreePlayRun, PuzzleEvent } from '@chesspecker/api-definitions';

import { Puzzle } from '../../puzzle/puzzle.entity';

import { PuzzleAttemptClosure } from './puzzle-attempt-closure.enum';
import { PuzzleAttemptKind } from './puzzle-attempt-kind.enum';

export interface TrainingAttemptHistory {
	attempts: TrainingAttempt[];
	cursor: string;
	hasMore: boolean;
}

export interface TrainingAttempt {
	uuid: string;
	kind: PuzzleAttemptKind;
	puzzle: Puzzle;
	roundUuid?: string;
	cycleItemUuid?: string;
	position?: number;
	durationMs: number;
	solved: boolean;
	closure: PuzzleAttemptClosure;
	hintUsed: boolean;
	mistakeCount: number;
	record: PuzzleEvent[];
	freePlayRuns: FreePlayRun[];
	createdAt: string;
	updatedAt: string;
}

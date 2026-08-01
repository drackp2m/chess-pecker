export type TrainingStatus = 'calibrating' | 'planning' | 'running' | 'finished' | 'abandoned';

export type TrainingFinishedReason = 'completed' | 'plateau' | 'max-cycles' | 'cancelled';

export type CalibrationRoundKind = 'scan' | 'refine';

export type CalibrationRoundOutcome = 'pending' | 'raise' | 'lower' | 'accept';

export type TrainingCycleStatus = 'running' | 'finished' | 'abandoned';

/**
 * An exercise as the API serves it. It is not the shape the board reads: there the
 * exercise is keyed by its Lichess id, while every write back to the API goes by
 * `uuid`, so both have to travel together. `PuzzleMapper` does the conversion.
 */
export interface ApiPuzzle {
	readonly uuid: string;
	readonly lichessId: string;
	readonly fen: string;
	readonly moves: readonly string[];
	readonly rating: number;
	readonly themes: readonly string[];
}

export interface Training {
	readonly uuid: string;
	readonly status: TrainingStatus;
	readonly finishedReason?: TrainingFinishedReason;
	readonly finishedAt?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface CalibrationRound {
	readonly uuid: string;
	readonly index: number;
	readonly kind: CalibrationRoundKind;
	readonly rating: number;
	readonly outcome: CalibrationRoundOutcome;
}

export interface CalibrationRoundStart {
	readonly round: CalibrationRound;
	readonly puzzles: readonly ApiPuzzle[];
}

/**
 * Una ronda a medias: lo que queda por intentar no basta para situarse en ella, así que
 * el reparto entero viaja aparte y es lo que cuenta el indicador.
 */
export interface CalibrationRoundPuzzles {
	readonly total: number;
	readonly attempted: number;
	readonly puzzles: readonly ApiPuzzle[];
}

export interface PuzzleAttempt {
	readonly uuid: string;
	readonly durationMs: number;
	readonly solved: boolean;
}

export interface CalibrationAttemptResult {
	readonly attempt: PuzzleAttempt;
	readonly outcome: CalibrationRoundOutcome;
}

export interface TrainingCycle {
	readonly uuid: string;
	readonly index: number;
	readonly status: TrainingCycleStatus;
	readonly createdAt: string;
}

export interface TrainingCycleItem {
	readonly uuid: string;
	readonly position: number;
	readonly trainingPuzzle: { readonly uuid: string; readonly puzzle: ApiPuzzle };
}

export interface CycleAttemptResult {
	readonly attempt: PuzzleAttempt;
	readonly cycleFinished: boolean;
}

// ToDo => neither request carries `createdAt` / `updatedAt`, so the server stamps both
// with its own clock. The schema treats them as domain data — when the exercise was
// first opened and when it was closed — and `SyncTimestampsDto` already accepts them;
// they are what the progress screen groups by day, and what stops someone who trained
// for weeks without an account from having their whole history collapse onto the day
// they registered. The front has to keep them per attempt and send them here.
export interface SubmitCalibrationAttemptRequest {
	readonly roundUuid: string;
	readonly puzzleUuid: string;
	readonly durationMs: number;
	readonly solved: boolean;
}

export interface SubmitCycleAttemptRequest {
	readonly cycleItemUuid: string;
	readonly durationMs: number;
	readonly solved: boolean;
}

export interface TrainingGoalRequest {
	readonly puzzlesPerDay?: number;
	readonly endDate?: string;
}

export interface CycleProgress {
	readonly uuid: string;
	readonly index: number;
	readonly status: TrainingCycleStatus;
	readonly attempted: number;
	readonly total: number;
	readonly solved: number;
	readonly accuracy: number;
	readonly totalDurationMs: number;
	readonly averageDurationMs: number;
	readonly targetDurationMs: number | null;
	readonly lastAttemptAt: string | null;
}

export interface CalibrationProgress {
	readonly rating: number | null;
	readonly averageDurationMs: number | null;
	readonly rounds: number;
}

export interface TrainingProgress {
	readonly calibration: CalibrationProgress;
	readonly setSize: number;
	readonly goal: { readonly puzzlesPerDay: number | null; readonly endDate: string | null } | null;
	readonly estimatedFirstCycleDays: number | null;
	readonly cycles: readonly CycleProgress[];
	readonly suggestFinish: boolean;
}

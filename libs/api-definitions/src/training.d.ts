import { ApiPuzzle } from './puzzle';
import { SyncTimestamps } from './sync';

export type TrainingStatus = 'calibrating' | 'planning' | 'running' | 'finished' | 'abandoned';

export type TrainingFinishedReason = 'completed' | 'plateau' | 'max-cycles' | 'cancelled';

export type CalibrationRoundKind = 'scan' | 'refine';

export type CalibrationRoundOutcome = 'pending' | 'raise' | 'lower' | 'accept';

export type TrainingCycleStatus = 'running' | 'finished' | 'abandoned';

export type PuzzleAttemptKind = 'calibration' | 'cycle';

/**
 * Cómo acabó el ejercicio: el usuario dio con la línea, o se rindió y se la enseñaron. No
 * hay estado abierto porque el intento no se manda hasta que la solución está fuera.
 */
export type PuzzleAttemptClosure = 'found' | 'revealed';

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

export interface TrainingGoal {
	readonly uuid: string;
	readonly puzzlesPerDay?: number;
	readonly endDate?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface SelectTrainingSetRequest {
	size?: number;
}

export interface SelectTrainingSetResult {
	readonly size: number;
}

export interface SetTrainingGoalRequest<TDate = string> extends SyncTimestamps<TDate> {
	puzzlesPerDay?: number;
	endDate?: TDate;
}

/**
 * Cómo fue el intento, igual en calibración que en ciclo. `solved` es la nota, sellada al
 * primer intento; el resto cuenta lo que costó llegar hasta la solución.
 */
export interface PuzzleAttemptRecord {
	durationMs: number;
	solved: boolean;
	closure: PuzzleAttemptClosure;
	hintUsed: boolean;
	mistakeCount: number;
}

export interface SubmitCalibrationAttemptRequest<TDate = string>
	extends SyncTimestamps<TDate>, PuzzleAttemptRecord {
	roundUuid: string;
	puzzleUuid: string;
}

export interface SubmitCycleAttemptRequest<TDate = string>
	extends SyncTimestamps<TDate>, PuzzleAttemptRecord {
	cycleItemUuid: string;
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

export interface CalibrationRoundProgress {
	readonly uuid: string;
	readonly index: number;
	readonly kind: CalibrationRoundKind;
	readonly rating: number;
	readonly outcome: CalibrationRoundOutcome;
	readonly attempted: number;
	readonly total: number;
	readonly solved: number;
	readonly averageDurationMs: number;
}

export interface CalibrationProgress {
	readonly rating: number | null;
	readonly averageDurationMs: number | null;
	readonly rounds: readonly CalibrationRoundProgress[];
}

export interface TrainingProgress {
	readonly calibration: CalibrationProgress;
	readonly setSize: number;
	readonly goal: { readonly puzzlesPerDay: number | null; readonly endDate: string | null } | null;
	readonly estimatedFirstCycleDays: number | null;
	readonly cycles: readonly CycleProgress[];
	readonly suggestFinish: boolean;
}

/** Un día con al menos un ejercicio cerrado; los días sin actividad no viajan. */
export interface TrainingActivityDay {
	readonly date: string;
	readonly count: number;
	readonly solved: number;
	readonly failed: number;
	readonly resigned: number;
	readonly mistakes: number;
	readonly hints: number;
	readonly durationMs: number;
}

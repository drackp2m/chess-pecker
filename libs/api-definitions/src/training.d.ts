import { ApiPuzzle } from './puzzle';
import { SyncTimestamps } from './sync';

export type TrainingStatus = 'calibrating' | 'planning' | 'running' | 'finished' | 'cancelled';

export type TrainingFinishedReason = 'completed' | 'plateau' | 'max-cycles' | 'cancelled';

export type CalibrationRoundKind = 'exploration' | 'refine';

export type CalibrationRoundOutcome = 'pending' | 'raise' | 'lower' | 'accept';

export type TrainingCycleStatus = 'running' | 'finished' | 'cancelled';

export type PuzzleAttemptKind = 'calibration' | 'cycle';

/**
 * How the exercise ended: the line was found, or it was given up on and shown. There is no
 * open state because an attempt is not sent until the solution is out.
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

/**
 * A half-finished round: what is left to attempt does not locate you within it, so the
 * whole set travels separately and is what the indicator counts.
 */
export interface CalibrationRoundPuzzles {
	readonly total: number;
	readonly attempted: number;
	readonly puzzles: readonly ApiPuzzle[];
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

export interface TrainingGoal {
	readonly uuid: string;
	readonly puzzlesPerDay?: number;
	readonly endDate?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface SetTrainingGoalRequest<TDate = string> extends SyncTimestamps<TDate> {
	puzzlesPerDay?: number;
	endDate?: TDate;
}

/** One step of the game: a move in long notation, or a negative marker. */
export type PuzzleEvent = string | number;

/** A visit to free play: where the main line stood, and what was played inside. */
export interface FreePlayRun {
	at: number;
	events: PuzzleEvent[];
}

/**
 * How the attempt went, the same in calibration as in a cycle. `solved` is the grade, sealed
 * on the first try; `record` and `freePlayRuns` redraw the exercise exactly as it was solved.
 */
export interface PuzzleAttemptRecord {
	durationMs: number;
	solved: boolean;
	closure: PuzzleAttemptClosure;
	hintUsed: boolean;
	mistakeCount: number;
	record: PuzzleEvent[];
	freePlayRuns: FreePlayRun[];
}

export interface CycleProgress {
	readonly uuid: string;
	readonly index: number;
	readonly status: TrainingCycleStatus;
	readonly startedAt: string;
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

export interface GetTrainingAttemptsRequest {
	/**
	 * The previous response's opaque `cursor`: the attempt the page was cut at, not a date.
	 * Without it the download starts over, which is what an empty device needs.
	 */
	since?: string;
	/** Attempts per page. The backend clamps it to the maximum it serves. */
	limit?: number;
}

/**
 * A training's history as the server stored it, which is where a device with nothing —
 * brand new, or emptied on logout — rebuilds the exercises already solved from.
 */
export interface TrainingAttemptHistory {
	readonly attempts: readonly TrainingAttempt[];
	/**
	 * Where the next response carries on from, stored as given and returned unread. A row and
	 * not a timestamp on purpose: the server clock has microseconds and the client's does not.
	 */
	readonly cursor: string;
	/** Attempts remain past the cursor, so it has to be asked again. */
	readonly hasMore: boolean;
}

/**
 * A closed attempt with the whole game inside. Board orientation does not travel: it is
 * derived from the FEN, so a manual flip does not survive the trip.
 */
export interface TrainingAttempt extends PuzzleAttemptRecord {
	readonly uuid: string;
	readonly kind: PuzzleAttemptKind;
	readonly puzzle: ApiPuzzle;
	readonly roundUuid?: string;
	readonly cycleItemUuid?: string;
	/**
	 * Its place in the cycle, from 0. It travels with the attempt because the device restoring
	 * it may not have the cycle order, only the slots it was served.
	 */
	readonly position?: number;
	/** When the exercise was opened and closed, both on the client clock. */
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface GetTrainingActivityRequest<TDate = string> {
	/** @deprecated The web app aggregates activity from local attempts. */
	/** Days the breakdown covers, today included. The backend clamps it to its maximum. */
	days?: number;
	/**
	 * The previous response's `cursor`. With it only the days touched since come back, so the
	 * rest can be cached locally without going stale when another device uploads.
	 */
	since?: TDate;
}

export interface TrainingActivity {
	/** @deprecated The web app aggregates activity from local attempts. */
	/** Every day in range with activity, or only those touched when `since` was sent. */
	readonly days: readonly TrainingActivityDay[];
	/** How far this response reaches, in server time. Stored as given and sent back next time. */
	readonly cursor: string;
}

/**
 * A day with at least one closed exercise. `firstTry`/`afterMiss`/`shown` split the day's
 * `done` by verdict, `found*`/`revealed*` by ending crossed with help taken; the two splits
 * cover the same attempts and neither is derived from the other.
 */
export interface TrainingActivityDay {
	readonly date: string;
	readonly done: number;
	readonly firstTry: number;
	readonly afterMiss: number;
	readonly shown: number;
	readonly foundClean: number;
	readonly foundHinted: number;
	readonly foundMissed: number;
	readonly foundMissedHinted: number;
	readonly revealed: number;
	readonly revealedHinted: number;
	readonly mistakes: number;
	readonly hints: number;
	readonly durationMs: number;
}

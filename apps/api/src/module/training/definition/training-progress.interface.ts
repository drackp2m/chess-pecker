import { CalibrationRoundKind } from './calibration-round-kind.enum';
import { CalibrationRoundOutcome } from './calibration-round-outcome.enum';

export interface CycleProgress {
	uuid: string;
	index: number;
	status: string;
	startedAt: Date;
	/** How many of the X exercises carry an attempt. */
	attempted: number;
	total: number;
	solved: number;
	/** Between 0 and 1; it should hold or rise with each cycle. */
	accuracy: number;
	/** The solving times added up; it should fall with each cycle. */
	totalDurationMs: number;
	averageDurationMs: number;
	/** The total time this cycle is held to. Null on cycle 1, which sets the bar. */
	targetDurationMs: number | null;
	/** The cycle's last exercise closing, which is when it ended. */
	lastAttemptAt: Date | null;
}

export interface CalibrationRoundProgress {
	uuid: string;
	index: number;
	kind: CalibrationRoundKind;
	rating: number;
	/** What the round decided: raise, lower, accept the band, or `pending` while open. */
	outcome: CalibrationRoundOutcome;
	/** How many of those dealt out carry an attempt, and how many of those were solved. */
	attempted: number;
	total: number;
	solved: number;
	averageDurationMs: number;
}

export interface CalibrationProgress {
	/** The hundred that was accepted, or null while the calibration is open. */
	rating: number | null;
	averageDurationMs: number | null;
	/** One entry per round, in the order they were played. */
	rounds: CalibrationRoundProgress[];
}

export interface TrainingProgress {
	calibration: CalibrationProgress;
	setSize: number;
	goal: { puzzlesPerDay: number | null; endDate: Date | null } | null;
	/** Days estimated for cycle 1 at the current pace. */
	estimatedFirstCycleDays: number | null;
	cycles: CycleProgress[];
	/** A suggestion to stop: the minimum cycles are done and improvement has flattened. */
	suggestFinish: boolean;
}

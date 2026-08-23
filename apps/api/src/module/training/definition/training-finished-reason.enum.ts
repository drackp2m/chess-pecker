export enum TrainingFinishedReason {
	/** The minimum cycles are done and they chose to stop. */
	Completed = 'completed',
	/** Improvement between cycles flattened out. */
	Plateau = 'plateau',
	/** It reached the cycle cap. */
	MaxCycles = 'max-cycles',
	/** The user cancelled it. */
	Cancelled = 'cancelled',
}

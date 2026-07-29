export enum TrainingFinishedReason {
	/** Completó el mínimo de ciclos y decidió parar. */
	Completed = 'completed',
	/** Dejó de mejorar entre ciclos. */
	Plateau = 'plateau',
	/** Llegó al tope de ciclos. */
	MaxCycles = 'max-cycles',
	/** Lo canceló el usuario. */
	Cancelled = 'cancelled',
}

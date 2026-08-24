export enum CalibrationRoundKind {
	/** Exploration: a single exercise, to narrow the ELO region. */
	Exploration = 'exploration',
	/** Refine: ten exercises at the same ELO, to measure the success rate. */
	Refine = 'refine',
}

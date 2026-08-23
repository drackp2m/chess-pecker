export enum CalibrationRoundKind {
	/** Scan: a single exercise, to narrow the ELO region. */
	Scan = 'scan',
	/** Refine: ten exercises at the same ELO, to measure the success rate. */
	Refine = 'refine',
}

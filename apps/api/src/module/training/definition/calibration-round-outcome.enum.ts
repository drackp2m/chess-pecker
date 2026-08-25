export enum CalibrationRoundOutcome {
	/** It still has attempts to go. */
	Pending = 'pending',
	Raise = 'raise',
	Lower = 'lower',
	Accept = 'accept',
}

/** The phase the training is in, not to be confused with the solving cycle. */
export enum TrainingStatus {
	Calibrating = 'calibrating',
	Planning = 'planning',
	Running = 'running',
	Finished = 'finished',
	Abandoned = 'abandoned',
}

/** La fase en la que está el entrenamiento. No confundir con el ciclo de resolución. */
export enum TrainingStatus {
	Calibrating = 'calibrating',
	Planning = 'planning',
	Running = 'running',
	Finished = 'finished',
	Abandoned = 'abandoned',
}

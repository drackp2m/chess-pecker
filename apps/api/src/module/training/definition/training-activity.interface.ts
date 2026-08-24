export interface TrainingActivity {
	days: TrainingActivityDay[];
	cursor: string;
}

export interface TrainingActivityDay {
	date: string;
	done: number;
	firstTry: number;
	afterMiss: number;
	shown: number;
	foundClean: number;
	foundHinted: number;
	foundMissed: number;
	foundMissedHinted: number;
	revealed: number;
	revealedHinted: number;
	mistakes: number;
	hints: number;
	durationMs: number;
}

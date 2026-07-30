export interface CycleProgress {
	uuid: string;
	index: number;
	status: string;
	/** Cuántos de los X ejercicios llevan intento. */
	attempted: number;
	total: number;
	solved: number;
	/** Entre 0 y 1; debe mantenerse alto o subir con cada pasada. */
	accuracy: number;
	/** Suma de los tiempos de resolución; debe bajar con cada pasada. */
	totalDurationMs: number;
	averageDurationMs: number;
	/** Sobre qué tiempo total se le exige esta pasada. Null en el ciclo 1, que es el listón. */
	targetDurationMs: number | null;
	/** Último cierre de ejercicio del ciclo, que es cuando terminó. */
	lastAttemptAt: Date | null;
}

export interface CalibrationProgress {
	/** La centena aceptada, o null si la calibración sigue abierta. */
	rating: number | null;
	averageDurationMs: number | null;
	rounds: number;
}

export interface TrainingProgress {
	calibration: CalibrationProgress;
	setSize: number;
	goal: { puzzlesPerDay: number | null; endDate: Date | null } | null;
	/** Días estimados para el ciclo 1 al ritmo vigente. */
	estimatedFirstCycleDays: number | null;
	cycles: CycleProgress[];
	/** Sugerencia de cierre: mínimo de ciclos cumplido y sin mejora apreciable. */
	suggestFinish: boolean;
}

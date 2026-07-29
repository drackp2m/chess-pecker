/**
 * Las decisiones del método que son política de la app, no esquema. Están juntas aquí para
 * que cambiarlas sea tocar un fichero y no migrar filas.
 */
export const TrainingPolicy = {
	/** Rango de ELO del catálogo, en centenas cerradas. */
	minRating: 400,
	maxRating: 2500,

	/** Sondeos iniciales: ejercicios sueltos, para acotar la zona antes de gastar rondas de 10. */
	scanRounds: 4,
	scanStartRating: 1200,
	/** Salto del primer sondeo; se parte por la mitad en cada uno siguiente. */
	scanInitialStep: 600,

	/** Ejercicios por ronda de afinado. */
	refinePuzzles: 10,
	/** Por encima de esta tasa de acierto el nivel se queda corto; por debajo, se pasa. */
	refineUpperAccuracy: 0.9,
	refineLowerAccuracy: 0.8,

	/** Tamaño del set de trabajo y ancho de la franja de ELO de la que se saca. */
	defaultSetSize: 1000,
	setRatingSpread: 100,

	/** Ancho del bloque dentro del que se baraja entre ciclos, manteniendo fácil → difícil. */
	shuffleBlockSize: 100,

	minCycles: 4,
	maxCycles: 7,

	/**
	 * Exigencia de cada ciclo sobre el tiempo real del ciclo 1. El índice 0 es el ciclo 2;
	 * a partir del último valor se mantiene el último factor.
	 */
	cycleTargetFactors: [0.5, 0.35, 0.25],

	/** Por debajo de esta mejora entre ciclos se considera que ya no rinde seguir. */
	plateauImprovement: 0.1,
} as const;

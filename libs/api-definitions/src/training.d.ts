import { ApiPuzzle } from './puzzle';
import { SyncTimestamps } from './sync';

export type TrainingStatus = 'calibrating' | 'planning' | 'running' | 'finished' | 'abandoned';

export type TrainingFinishedReason = 'completed' | 'plateau' | 'max-cycles' | 'cancelled';

export type CalibrationRoundKind = 'scan' | 'refine';

export type CalibrationRoundOutcome = 'pending' | 'raise' | 'lower' | 'accept';

export type TrainingCycleStatus = 'running' | 'finished' | 'abandoned';

export type PuzzleAttemptKind = 'calibration' | 'cycle';

/**
 * Cómo acabó el ejercicio: el usuario dio con la línea, o se rindió y se la enseñaron. No
 * hay estado abierto porque el intento no se manda hasta que la solución está fuera.
 */
export type PuzzleAttemptClosure = 'found' | 'revealed';

export interface Training {
	readonly uuid: string;
	readonly status: TrainingStatus;
	readonly finishedReason?: TrainingFinishedReason;
	readonly finishedAt?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface CalibrationRound {
	readonly uuid: string;
	readonly index: number;
	readonly kind: CalibrationRoundKind;
	readonly rating: number;
	readonly outcome: CalibrationRoundOutcome;
}

export interface CalibrationRoundStart {
	readonly round: CalibrationRound;
	readonly puzzles: readonly ApiPuzzle[];
}

/**
 * Una ronda a medias: lo que queda por intentar no basta para situarse en ella, así que
 * el reparto entero viaja aparte y es lo que cuenta el indicador.
 */
export interface CalibrationRoundPuzzles {
	readonly total: number;
	readonly attempted: number;
	readonly puzzles: readonly ApiPuzzle[];
}

export interface PuzzleAttempt {
	readonly uuid: string;
	readonly durationMs: number;
	readonly solved: boolean;
}

export interface CalibrationAttemptResult {
	readonly attempt: PuzzleAttempt;
	readonly outcome: CalibrationRoundOutcome;
}

export interface TrainingCycle {
	readonly uuid: string;
	readonly index: number;
	readonly status: TrainingCycleStatus;
	readonly createdAt: string;
}

export interface TrainingCycleItem {
	readonly uuid: string;
	readonly position: number;
	readonly trainingPuzzle: { readonly uuid: string; readonly puzzle: ApiPuzzle };
}

export interface CycleAttemptResult {
	readonly attempt: PuzzleAttempt;
	readonly cycleFinished: boolean;
}

export interface TrainingGoal {
	readonly uuid: string;
	readonly puzzlesPerDay?: number;
	readonly endDate?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface SelectTrainingSetRequest {
	size?: number;
}

export interface SelectTrainingSetResult {
	readonly size: number;
}

export interface SetTrainingGoalRequest<TDate = string> extends SyncTimestamps<TDate> {
	puzzlesPerDay?: number;
	endDate?: TDate;
}

/** Un paso de la partida: una jugada en notación larga, o un marcador negativo. */
export type PuzzleEvent = string | number;

/** Una visita al juego libre: dónde estaba la línea principal, y qué se jugó dentro. */
export interface FreePlayRun {
	at: number;
	events: PuzzleEvent[];
}

/**
 * Cómo fue el intento, igual en calibración que en ciclo. `solved` es la nota, sellada al
 * primer intento; el resto cuenta lo que costó llegar hasta la solución.
 *
 * `record` y `explorations` son la partida entera —la línea principal y lo que se probó
 * fuera de ella—, con la que se puede volver a dibujar el ejercicio tal como se resolvió.
 */
export interface PuzzleAttemptRecord {
	durationMs: number;
	solved: boolean;
	closure: PuzzleAttemptClosure;
	hintUsed: boolean;
	mistakeCount: number;
	record: PuzzleEvent[];
	explorations: FreePlayRun[];
}

export interface SubmitCalibrationAttemptRequest<TDate = string>
	extends SyncTimestamps<TDate>, PuzzleAttemptRecord {
	roundUuid: string;
	puzzleUuid: string;
}

export interface SubmitCycleAttemptRequest<TDate = string>
	extends SyncTimestamps<TDate>, PuzzleAttemptRecord {
	cycleItemUuid: string;
}

export interface CycleProgress {
	readonly uuid: string;
	readonly index: number;
	readonly status: TrainingCycleStatus;
	readonly startedAt: string;
	readonly attempted: number;
	readonly total: number;
	readonly solved: number;
	readonly accuracy: number;
	readonly totalDurationMs: number;
	readonly averageDurationMs: number;
	readonly targetDurationMs: number | null;
	readonly lastAttemptAt: string | null;
}

export interface CalibrationRoundProgress {
	readonly uuid: string;
	readonly index: number;
	readonly kind: CalibrationRoundKind;
	readonly rating: number;
	readonly outcome: CalibrationRoundOutcome;
	readonly attempted: number;
	readonly total: number;
	readonly solved: number;
	readonly averageDurationMs: number;
}

export interface CalibrationProgress {
	readonly rating: number | null;
	readonly averageDurationMs: number | null;
	readonly rounds: readonly CalibrationRoundProgress[];
}

export interface TrainingProgress {
	readonly calibration: CalibrationProgress;
	readonly setSize: number;
	readonly goal: { readonly puzzlesPerDay: number | null; readonly endDate: string | null } | null;
	readonly estimatedFirstCycleDays: number | null;
	readonly cycles: readonly CycleProgress[];
	readonly suggestFinish: boolean;
}

export interface GetTrainingAttemptsRequest<TDate = string> {
	/**
	 * El `cursor` de la respuesta anterior. Sin él se empieza por el principio, que es lo
	 * que necesita un dispositivo vacío; con él, sólo lo que haya entrado después, venga del
	 * dispositivo que venga.
	 */
	since?: TDate;
	/** Intentos por página. El backend recorta al máximo que sirve. */
	limit?: number;
}

/**
 * El histórico de un entrenamiento tal como lo guardó el servidor, que es de donde un
 * dispositivo sin nada —recién estrenado, o vaciado al cerrar sesión— vuelve a levantar
 * los ejercicios ya resueltos.
 */
export interface TrainingAttemptHistory {
	readonly attempts: readonly TrainingAttempt[];
	/**
	 * Hasta dónde llega esta respuesta, en tiempo de servidor: el final de la página si
	 * quedan más, y si no, lo último que el servidor había recibido. Se guarda tal cual y se
	 * devuelve en la siguiente petición, sea para seguir paginando o para preguntar mañana.
	 */
	readonly cursor: string;
	/** Quedan intentos después del cursor: hay que volver a preguntar con él. */
	readonly hasMore: boolean;
}

/**
 * Un intento cerrado, con la partida entera dentro: `record` y `explorations` son lo que
 * permite volver a dibujarlo. Lo que no viaja es la orientación del tablero, que no se
 * guarda —se deduce del FEN— y el volteo manual no sobrevive al viaje.
 */
export interface TrainingAttempt extends PuzzleAttemptRecord {
	readonly uuid: string;
	readonly kind: PuzzleAttemptKind;
	readonly puzzle: ApiPuzzle;
	readonly roundUuid?: string;
	readonly cycleItemUuid?: string;
	/**
	 * Su sitio dentro de la pasada, empezando en 0. Viaja con el intento porque el
	 * dispositivo que lo restaura puede no tener el orden del ciclo: sólo conoce los huecos
	 * que le fueron sirviendo.
	 */
	readonly position?: number;
	/** Cuándo se abrió el ejercicio y cuándo se cerró, ambos con el reloj del cliente. */
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface GetTrainingActivityRequest<TDate = string> {
	/** Días que cubre el desglose, hoy incluido. El backend recorta al máximo que sirve. */
	days?: number;
	/**
	 * El `cursor` de la respuesta anterior. Con él sólo vuelven los días que hayan
	 * recibido intentos después, que es lo que permite guardar el resto en local sin
	 * quedarse con una foto vieja cuando otro dispositivo sube lo suyo.
	 */
	since?: TDate;
}

export interface TrainingActivity {
	/** Todos los días del rango con actividad, o sólo los tocados si se mandó `since`. */
	readonly days: readonly TrainingActivityDay[];
	/**
	 * Hasta dónde llega esta respuesta, en tiempo de servidor. Se guarda tal cual y se
	 * devuelve en la siguiente petición.
	 */
	readonly cursor: string;
}

/**
 * Un día con al menos un ejercicio cerrado; los días sin actividad no viajan.
 *
 * Dos lecturas del mismo día que no se derivan la una de la otra. `solved` / `failed` /
 * `resigned` reparten por el veredicto, que se sella en la primera jugada. Los `found*` /
 * `revealed*` reparten por cómo acabó el ejercicio cruzado con qué ayuda hizo falta, y ahí
 * un `foundMissed` puede ser un acierto que falló más adelante en la línea.
 */
export interface TrainingActivityDay {
	readonly date: string;
	readonly count: number;
	readonly solved: number;
	readonly failed: number;
	readonly resigned: number;
	readonly foundClean: number;
	readonly foundHinted: number;
	readonly foundMissed: number;
	readonly foundMissedHinted: number;
	readonly revealed: number;
	readonly revealedHinted: number;
	readonly mistakes: number;
	readonly hints: number;
	readonly durationMs: number;
}

import { ApiPuzzle } from './puzzle';
import {
	CalibrationRoundKind,
	CalibrationRoundOutcome,
	FreePlayRun,
	PuzzleAttemptClosure,
	PuzzleEvent,
	TrainingCycleStatus,
	TrainingFinishedReason,
	TrainingStatus,
} from './training';

export interface SyncTimestamps<TDate = string> {
	createdAt?: TDate;
	updatedAt?: TDate;
}

/** Las ocho tablas que se sincronizan, con el nombre que llevan a los dos lados. */
export type SyncEntity =
	| 'training'
	| 'trainingGoal'
	| 'calibrationRound'
	| 'calibrationPuzzle'
	| 'trainingPuzzle'
	| 'cycle'
	| 'cycleItem'
	| 'attempt';

/**
 * Cómo se nombra una fila en la subida. `clientRef` es el uuid con el que nació en un
 * dispositivo y es la clave de reintento: el servidor busca por él antes de insertar, así
 * que repetir una subida cortada no duplica nada. `uuid` sólo lo llevan las filas que ya
 * están arriba —el servidor es quien reparte las claves primarias, siempre—.
 */
export interface SyncNode<TDate = string> extends SyncTimestamps<TDate> {
	clientRef?: string;
	uuid?: string;
}

export interface PushTrainingRequest<TDate = string> {
	training: PushTrainingNode<TDate>;
}

export interface PushTrainingNode<TDate = string> extends SyncNode<TDate> {
	status: TrainingStatus;
	finishedReason?: TrainingFinishedReason;
	finishedAt?: TDate;
	goals: PushGoalNode<TDate>[];
	rounds: PushCalibrationRoundNode<TDate>[];
	puzzles: PushTrainingPuzzleNode<TDate>[];
	cycles: PushCycleNode<TDate>[];
}

export interface PushGoalNode<TDate = string> extends SyncNode<TDate> {
	puzzlesPerDay?: number;
	endDate?: TDate;
}

export interface PushCalibrationRoundNode<TDate = string> extends SyncNode<TDate> {
	index: number;
	kind: CalibrationRoundKind;
	rating: number;
	outcome: CalibrationRoundOutcome;
	puzzles: PushCalibrationPuzzleNode<TDate>[];
	attempts: PushAttemptNode<TDate>[];
}

export interface PushCalibrationPuzzleNode<TDate = string> extends SyncNode<TDate> {
	lichessId: string;
	position: number;
}

export interface PushTrainingPuzzleNode<TDate = string> extends SyncNode<TDate> {
	lichessId: string;
}

export interface PushCycleNode<TDate = string> extends SyncNode<TDate> {
	index: number;
	status: TrainingCycleStatus;
	items: PushCycleItemNode<TDate>[];
}

export interface PushCycleItemNode<TDate = string> extends SyncNode<TDate> {
	/** El `clientRef` del ejercicio del set al que apunta, o su uuid si ya está arriba. */
	trainingPuzzleRef: string;
	position: number;
	attempts: PushAttemptNode<TDate>[];
}

/**
 * El intento no dice de qué tipo es: lo dice dónde cuelga. Uno que viaja dentro de una
 * ronda es de calibración y uno que viaja dentro de un hueco de ciclo es de ciclo, que es
 * exactamente lo que exige el `check` de la tabla.
 */
export interface PushAttemptNode<TDate = string> extends SyncNode<TDate> {
	lichessId: string;
	durationMs: number;
	solved: boolean;
	closure: PuzzleAttemptClosure;
	hintUsed: boolean;
	mistakeCount: number;
	record: PuzzleEvent[];
	explorations: FreePlayRun[];
}

export interface SyncTreeRow<TDate = string> {
	readonly uuid: string;
	readonly clientRef?: string;
	readonly createdAt: TDate;
	readonly updatedAt: TDate;
	readonly receivedAt: TDate;
}

export interface SyncTrainingTree<TDate = string> {
	readonly training: SyncTreeTrainingNode<TDate>;
	readonly goals: readonly SyncTreeGoalNode<TDate>[];
	readonly rounds: readonly SyncTreeRoundNode<TDate>[];
	readonly set: readonly SyncTreeSetNode<TDate>[];
	readonly cycles: readonly SyncTreeCycleNode<TDate>[];
	readonly puzzles: readonly ApiPuzzle[];
}

export interface SyncTreeTrainingNode<TDate = string> extends SyncTreeRow<TDate> {
	readonly status: TrainingStatus;
	readonly finishedReason?: TrainingFinishedReason;
	readonly finishedAt?: TDate;
}

export interface SyncTreeGoalNode<TDate = string> extends SyncTreeRow<TDate> {
	readonly puzzlesPerDay?: number;
	readonly endDate?: string;
}

export interface SyncTreeRoundNode<TDate = string> extends SyncTreeRow<TDate> {
	readonly index: number;
	readonly kind: CalibrationRoundKind;
	readonly rating: number;
	readonly outcome: CalibrationRoundOutcome;
	readonly puzzles: readonly SyncTreeDealtNode<TDate>[];
}

export interface SyncTreeDealtNode<TDate = string> extends SyncTreeRow<TDate> {
	readonly lichessId: string;
	readonly position: number;
}

export interface SyncTreeSetNode<TDate = string> extends SyncTreeRow<TDate> {
	readonly lichessId: string;
}

export interface SyncTreeCycleNode<TDate = string> extends SyncTreeRow<TDate> {
	readonly index: number;
	readonly status: TrainingCycleStatus;
	readonly items: readonly SyncTreeItemNode<TDate>[];
}

export interface SyncTreeItemNode<TDate = string> extends SyncTreeRow<TDate> {
	readonly trainingPuzzleUuid: string;
	readonly lichessId: string;
	readonly position: number;
}

export interface SyncEntitySummary {
	/** `MAX(received_at)` del usuario en esa tabla, o `null` si no tiene ni una fila. */
	readonly cursor: string | null;
	/** Porque un `MAX` no ve los borrados: marca y recuento iguales es «al día». */
	readonly count: number;
}

/**
 * Qué hay del otro lado, en una sola pregunta. Es lo que decide si hay algo que bajar sin
 * tener que preguntar tabla a tabla ni entrenamiento a entrenamiento.
 */
export interface SyncSummary {
	readonly serverTime: string;
	/** El modelo que corre el servidor. Un cliente más viejo baja, pero no sube. */
	readonly schemaVersion: number;
	readonly entities: Record<SyncEntity, SyncEntitySummary>;
	/** `puzzle` no es de nadie: es catálogo global y tiene su propia forma. */
	readonly catalog: SyncCatalogSummary;
}

export interface SyncCatalogSummary {
	/** `MAX(updated_at)` del catálogo. Se mueve cuando se reimporta, aunque el total no. */
	readonly version: string;
	readonly total: number;
}

/** Una fila que el servidor no va a aceptar nunca. El cliente la marca y deja de reintentarla. */
export interface SyncRejection {
	readonly clientRef: string;
	readonly entity: SyncEntity;
	readonly reason: string;
}

export interface PushTrainingResult {
	/**
	 * El reloj de servidor con el que entró todo lo de esta subida. El cliente adelanta su
	 * cursor con él, y así la bajada siguiente no se trae lo que acaba de subir.
	 */
	readonly receivedAt: string;
	/** Por entidad, `clientRef` → uuid definitivo. Es con lo que el cliente reclava sus filas. */
	readonly uuids: Record<SyncEntity, Record<string, string>>;
	readonly rejected: readonly SyncRejection[];
}

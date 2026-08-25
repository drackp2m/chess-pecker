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

/** The eight tables that sync, under the name they carry on both sides. */
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
 * How a row is named in a push. `clientRef` is the uuid it was born with and the retry key;
 * `uuid` only appears once a row is up, since the server always issues primary keys.
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
	/** The `clientRef` of the set exercise it points at, or its uuid once that is up. */
	trainingPuzzleRef: string;
	position: number;
	attempts: PushAttemptNode<TDate>[];
}

/**
 * An attempt does not say what kind it is: where it hangs does, which is exactly what the
 * table's `check` demands.
 */
export interface PushAttemptNode<TDate = string> extends SyncNode<TDate> {
	lichessId: string;
	durationMs: number;
	solved: boolean;
	closure: PuzzleAttemptClosure;
	hintUsed: boolean;
	mistakeCount: number;
	record: PuzzleEvent[];
	freePlayRuns: FreePlayRun[];
}

export interface GetSyncTrainingTreeRequest<TDate = string> {
	since?: TDate;
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
	readonly itemCount: number;
	readonly items: readonly SyncTreeItemNode<TDate>[];
}

export interface SyncTreeItemNode<TDate = string> extends SyncTreeRow<TDate> {
	readonly trainingPuzzleUuid: string;
	readonly lichessId: string;
	readonly position: number;
}

export interface SyncEntitySummary {
	/** The user's `MAX(received_at)` in that table, or `null` with not a single row. */
	readonly cursor: string | null;
	/** Because a `MAX` cannot see deletions: matching stamp and count means current. */
	readonly count: number;
}

/**
 * What is on the other side, in one question: what decides whether there is anything to pull
 * without asking table by table or training by training.
 */
export interface SyncSummary {
	readonly serverTime: string;
	/** The model the server runs. An older client pulls, but never pushes. */
	readonly schemaVersion: number;
	readonly entities: Record<SyncEntity, SyncEntitySummary>;
	/** `puzzle` belongs to nobody: it is a global catalogue and has its own shape. */
	readonly catalog: SyncCatalogSummary;
}

export interface SyncCatalogSummary {
	/** The catalogue's `MAX(updated_at)`. It moves on a re-import even when the total does not. */
	readonly version: string;
	readonly total: number;
}

/** A row the server will never accept. The client marks it and stops retrying. */
export interface SyncRejection {
	readonly clientRef: string;
	readonly entity: SyncEntity;
	readonly reason: string;
}

export interface PushTrainingResult {
	/**
	 * The server clock everything in this push came in under. The client moves its cursor to
	 * it, so the next pull does not fetch back what it just sent.
	 */
	readonly receivedAt: string;
	/** Per entity, `clientRef` → final uuid: what the client rekeys its rows with. */
	readonly uuids: Record<SyncEntity, Record<string, string>>;
	readonly rejected: readonly SyncRejection[];
}

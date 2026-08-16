import type {
	CalibrationRoundKind,
	CalibrationRoundOutcome,
	TrainingCycleStatus,
	TrainingFinishedReason,
	TrainingStatus,
} from '@chesspecker/api-definitions';
import { DBSchema } from 'idb';

import { LocalRecord } from '@app/repository/definition/local-record.interface';

export interface TrainingRow extends LocalRecord {
	readonly uuid: string;
	readonly status: TrainingStatus;
	readonly finishedReason?: TrainingFinishedReason;
	readonly finishedAt?: Date;
}

export interface TrainingGoalRow extends LocalRecord {
	readonly uuid: string;
	readonly trainingUuid: string;
	readonly puzzlesPerDay?: number;
	readonly endDate?: string;
}

export interface CalibrationRoundRow extends LocalRecord {
	readonly uuid: string;
	readonly trainingUuid: string;
	readonly index: number;
	readonly kind: CalibrationRoundKind;
	readonly rating: number;
	readonly outcome: CalibrationRoundOutcome;
}

export interface CalibrationPuzzleRow extends LocalRecord {
	readonly uuid: string;
	readonly roundUuid: string;
	readonly lichessId: string;
	readonly position: number;
}

export interface TrainingPuzzleRow extends LocalRecord {
	readonly uuid: string;
	readonly trainingUuid: string;
	readonly lichessId: string;
	readonly rating: number;
}

export interface TrainingCycleRow extends LocalRecord {
	readonly uuid: string;
	readonly trainingUuid: string;
	readonly index: number;
	readonly status: TrainingCycleStatus;
}

export interface CycleItemRow extends LocalRecord {
	readonly uuid: string;
	readonly cycleUuid: string;
	readonly trainingPuzzleUuid: string;
	readonly lichessId: string;
	readonly position: number;
}

export interface TrainingSchema extends DBSchema {
	training: {
		key: string;
		value: TrainingRow;
		indexes: { status: string; pendingSince: Date };
	};
	trainingGoal: {
		key: string;
		value: TrainingGoalRow;
		indexes: { trainingUuid: string; pendingSince: Date };
	};
	calibrationRound: {
		key: string;
		value: CalibrationRoundRow;
		indexes: { trainingUuid: string; pendingSince: Date };
	};
	calibrationPuzzle: {
		key: string;
		value: CalibrationPuzzleRow;
		indexes: { roundUuid: string; pendingSince: Date };
	};
	trainingPuzzle: {
		key: string;
		value: TrainingPuzzleRow;
		indexes: { trainingUuid: string; pendingSince: Date };
	};
	cycle: {
		key: string;
		value: TrainingCycleRow;
		indexes: { trainingUuid: string; pendingSince: Date };
	};
	cycleItem: {
		key: string;
		value: CycleItemRow;
		indexes: { cycleUuid: string; pendingSince: Date };
	};
}

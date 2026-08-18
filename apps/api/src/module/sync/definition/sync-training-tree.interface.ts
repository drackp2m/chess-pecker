import { Puzzle } from '../../puzzle/puzzle.entity';
import { CalibrationRoundKind } from '../../training/definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from '../../training/definition/calibration-round-outcome.enum';
import { TrainingCycleStatus } from '../../training/definition/training-cycle-status.enum';
import { TrainingFinishedReason } from '../../training/definition/training-finished-reason.enum';
import { TrainingStatus } from '../../training/definition/training-status.enum';

export interface SyncTreeRow {
	uuid: string;
	clientRef?: string;
	createdAt: string;
	updatedAt: string;
	receivedAt: string;
}

export interface SyncTrainingTree {
	training: SyncTreeTrainingNode;
	goals: SyncTreeGoalNode[];
	rounds: SyncTreeRoundNode[];
	set: SyncTreeSetNode[];
	cycles: SyncTreeCycleNode[];
	puzzles: Puzzle[];
}

export interface SyncTreeTrainingNode extends SyncTreeRow {
	status: TrainingStatus;
	finishedReason?: TrainingFinishedReason;
	finishedAt?: string;
}

export interface SyncTreeGoalNode extends SyncTreeRow {
	puzzlesPerDay?: number;
	endDate?: string;
}

export interface SyncTreeRoundNode extends SyncTreeRow {
	index: number;
	kind: CalibrationRoundKind;
	rating: number;
	outcome: CalibrationRoundOutcome;
	puzzles: SyncTreeDealtNode[];
}

export interface SyncTreeDealtNode extends SyncTreeRow {
	lichessId: string;
	position: number;
}

export interface SyncTreeSetNode extends SyncTreeRow {
	lichessId: string;
}

export interface SyncTreeCycleNode extends SyncTreeRow {
	index: number;
	status: TrainingCycleStatus;
	itemCount: number;
	items: SyncTreeItemNode[];
}

export interface SyncTreeItemNode extends SyncTreeRow {
	trainingPuzzleUuid: string;
	lichessId: string;
	position: number;
}

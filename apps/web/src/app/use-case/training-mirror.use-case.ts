import { Injectable } from '@angular/core';
import type {
	ApiPuzzle,
	SyncTreeCycleNode,
	SyncTreeDealtNode,
	SyncTreeGoalNode,
	SyncTreeItemNode,
	SyncTreeRoundNode,
	SyncTreeRow,
	SyncTreeSetNode,
	SyncTreeTrainingNode,
} from '@chesspecker/api-definitions';

import { LocalRecord } from '@app/repository/definition/local-record.interface';
import {
	CalibrationPuzzleRow,
	CalibrationRoundRow,
	CycleItemRow,
	TrainingCycleRow,
	TrainingGoalRow,
	TrainingPuzzleRow,
	TrainingRow,
} from '@app/repository/definition/training-schema.interface';

export type PuzzleIndex = ReadonlyMap<string, ApiPuzzle>;

@Injectable({
	providedIn: 'root',
})
export class TrainingMirrorUseCase {
	training(node: SyncTreeTrainingNode): TrainingRow {
		return {
			...marks(node),
			uuid: node.uuid,
			status: node.status,
			...(undefined === node.finishedReason ? {} : { finishedReason: node.finishedReason }),
			...(undefined === node.finishedAt ? {} : { finishedAt: new Date(node.finishedAt) }),
		};
	}

	goal(trainingUuid: string, node: SyncTreeGoalNode): TrainingGoalRow {
		return {
			...marks(node),
			uuid: node.uuid,
			trainingUuid,
			...(undefined === node.puzzlesPerDay ? {} : { puzzlesPerDay: node.puzzlesPerDay }),
			...(undefined === node.endDate ? {} : { endDate: node.endDate }),
		};
	}

	round(trainingUuid: string, node: SyncTreeRoundNode): CalibrationRoundRow {
		return {
			...marks(node),
			uuid: node.uuid,
			trainingUuid,
			index: node.index,
			kind: node.kind,
			rating: node.rating,
			outcome: node.outcome,
		};
	}

	dealt(roundUuid: string, node: SyncTreeDealtNode): CalibrationPuzzleRow {
		return {
			...marks(node),
			uuid: node.uuid,
			roundUuid,
			lichessId: node.lichessId,
			position: node.position,
		};
	}

	setEntry(
		trainingUuid: string,
		node: SyncTreeSetNode,
		puzzles: PuzzleIndex,
	): TrainingPuzzleRow | undefined {
		const puzzle = puzzles.get(node.lichessId);

		if (undefined === puzzle) {
			return undefined;
		}

		return {
			...marks(node),
			uuid: node.uuid,
			trainingUuid,
			lichessId: node.lichessId,
			rating: puzzle.rating,
		};
	}

	cycle(trainingUuid: string, node: SyncTreeCycleNode): TrainingCycleRow {
		return {
			...marks(node),
			uuid: node.uuid,
			trainingUuid,
			index: node.index,
			status: node.status,
		};
	}

	cycleItem(cycleUuid: string, node: SyncTreeItemNode): CycleItemRow {
		return {
			...marks(node),
			uuid: node.uuid,
			cycleUuid,
			trainingPuzzleUuid: node.trainingPuzzleUuid,
			lichessId: node.lichessId,
			position: node.position,
		};
	}
}

function marks(node: SyncTreeRow): LocalRecord {
	return {
		createdAt: new Date(node.createdAt),
		updatedAt: new Date(node.updatedAt),
		syncedAt: new Date(node.receivedAt),
		...(undefined === node.clientRef ? {} : { clientRef: node.clientRef }),
	};
}

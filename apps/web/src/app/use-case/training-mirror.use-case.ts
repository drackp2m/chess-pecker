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
		const finishedReason = node.finishedReason ?? undefined;
		const finishedAt = node.finishedAt ?? undefined;

		return {
			...marks(node),
			uuid: node.uuid,
			status: node.status,
			...(undefined === finishedReason ? {} : { finishedReason }),
			...(undefined === finishedAt ? {} : { finishedAt: new Date(finishedAt) }),
		};
	}

	goal(trainingUuid: string, node: SyncTreeGoalNode): TrainingGoalRow {
		const puzzlesPerDay = node.puzzlesPerDay ?? undefined;
		const endDate = node.endDate ?? undefined;

		return {
			...marks(node),
			uuid: node.uuid,
			trainingUuid,
			...(undefined === puzzlesPerDay ? {} : { puzzlesPerDay }),
			...(undefined === endDate ? {} : { endDate }),
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
			expectedItems: node.itemCount,
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
	const clientRef = node.clientRef ?? undefined;

	return {
		createdAt: new Date(node.createdAt),
		updatedAt: new Date(node.updatedAt),
		syncedAt: new Date(node.receivedAt),
		...(undefined === clientRef ? {} : { clientRef }),
	};
}

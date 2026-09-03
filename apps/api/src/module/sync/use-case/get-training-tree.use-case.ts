import { Injectable } from '@nestjs/common';

import { toIsoDate } from '../../../shared/util/to-iso-date';
import { Puzzle } from '../../puzzle/puzzle.entity';
import { TrainingCalibrationPuzzle } from '../../training/training-calibration-puzzle.entity';
import { TrainingCalibrationPuzzleRepository } from '../../training/training-calibration-puzzle.repository';
import { TrainingCalibrationRoundRepository } from '../../training/training-calibration-round.repository';
import { TrainingCycleItem } from '../../training/training-cycle-item.entity';
import { TrainingCycleItemRepository } from '../../training/training-cycle-item.repository';
import { TrainingCycleRepository } from '../../training/training-cycle.repository';
import { TrainingGoalRepository } from '../../training/training-goal.repository';
import { TrainingPuzzle } from '../../training/training-puzzle.entity';
import { TrainingPuzzleRepository } from '../../training/training-puzzle.repository';
import { Training } from '../../training/training.entity';
import {
	SyncTrainingTree,
	SyncTreeCycleNode,
	SyncTreeDealtNode,
	SyncTreeGoalNode,
	SyncTreeItemNode,
	SyncTreeRoundNode,
	SyncTreeRow,
	SyncTreeSetNode,
	SyncTreeTrainingNode,
} from '../definition/sync-training-tree.interface';

interface SyncedEntity {
	uuid: string;
	clientRef?: string;
	createdAt: Date;
	updatedAt: Date;
	receivedAt: Date;
}

@Injectable()
export class GetTrainingTreeUseCase {
	constructor(
		private readonly trainingGoalRepository: TrainingGoalRepository,
		private readonly calibrationRoundRepository: TrainingCalibrationRoundRepository,
		private readonly calibrationPuzzleRepository: TrainingCalibrationPuzzleRepository,
		private readonly trainingPuzzleRepository: TrainingPuzzleRepository,
		private readonly trainingCycleRepository: TrainingCycleRepository,
		private readonly trainingCycleItemRepository: TrainingCycleItemRepository,
	) {}

	async execute(training: Training, since?: Date): Promise<SyncTrainingTree> {
		const uuid = training.uuid;
		const set = await this.trainingPuzzleRepository.getManyByTraining(uuid, since);
		const dealt = await this.calibrationPuzzleRepository.getManyByTraining(uuid, since);

		return {
			training: toTrainingNode(training),
			goals: await this.goalNodes(uuid),
			rounds: await this.roundNodes(uuid, dealt),
			set: set.map((entry) => toSetNode(entry)),
			cycles: await this.cycleNodes(uuid, since),
			puzzles: collectPuzzles(set, dealt),
		};
	}

	private async goalNodes(trainingUuid: string): Promise<SyncTreeGoalNode[]> {
		const goals = await this.trainingGoalRepository.getManyByTraining(trainingUuid);

		return goals.map((goal) => {
			const puzzlesPerDay = goal.puzzlesPerDay ?? undefined;
			const endDate = goal.endDate ?? undefined;

			return {
				...toRow(goal),
				...(undefined === puzzlesPerDay ? {} : { puzzlesPerDay }),
				...(undefined === endDate ? {} : { endDate: toDateString(endDate) }),
			};
		});
	}

	private async roundNodes(
		trainingUuid: string,
		dealt: TrainingCalibrationPuzzle[],
	): Promise<SyncTreeRoundNode[]> {
		const rounds = await this.calibrationRoundRepository.getManyByTraining(trainingUuid);
		const byRound = groupBy(dealt, (row) => row.calibrationRound.uuid);

		return rounds.map((round) => ({
			...toRow(round),
			index: round.index,
			kind: round.kind,
			rating: round.rating,
			outcome: round.outcome,
			puzzles: (byRound.get(round.uuid) ?? []).map((row) => toDealtNode(row)),
		}));
	}

	private async cycleNodes(trainingUuid: string, since?: Date): Promise<SyncTreeCycleNode[]> {
		const cycles = await this.trainingCycleRepository.getManyByTraining(trainingUuid);
		const items = await this.trainingCycleItemRepository.getManyByTraining(trainingUuid, since);
		const setSize = await this.trainingPuzzleRepository.countByTraining(trainingUuid);
		const byCycle = groupBy(items, (row) => row.cycle.uuid);

		return cycles.map((cycle) => ({
			...toRow(cycle),
			index: cycle.index,
			status: cycle.status,
			itemCount: Math.max(cycle.itemCount, setSize),
			items: (byCycle.get(cycle.uuid) ?? []).map((row) => toItemNode(row)),
		}));
	}
}

function toRow(entity: SyncedEntity): SyncTreeRow {
	const clientRef = entity.clientRef ?? undefined;

	return {
		uuid: entity.uuid,
		...(undefined === clientRef ? {} : { clientRef }),
		createdAt: toIsoDate(entity.createdAt),
		updatedAt: toIsoDate(entity.updatedAt),
		receivedAt: toIsoDate(entity.receivedAt),
	};
}

function toTrainingNode(training: Training): SyncTreeTrainingNode {
	const finishedReason = training.finishedReason ?? undefined;
	const finishedAt = training.finishedAt ?? undefined;

	return {
		...toRow(training),
		status: training.status,
		...(undefined === finishedReason ? {} : { finishedReason }),
		...(undefined === finishedAt ? {} : { finishedAt: toIsoDate(finishedAt) }),
	};
}

function toSetNode(entry: TrainingPuzzle): SyncTreeSetNode {
	return { ...toRow(entry), lichessId: entry.puzzle.lichessId };
}

function toDealtNode(row: TrainingCalibrationPuzzle): SyncTreeDealtNode {
	return { ...toRow(row), lichessId: row.puzzle.lichessId, position: row.position };
}

function toItemNode(row: TrainingCycleItem): SyncTreeItemNode {
	return {
		...toRow(row),
		trainingPuzzleUuid: row.trainingPuzzle.uuid,
		lichessId: row.trainingPuzzle.puzzle.lichessId,
		position: row.position,
	};
}

function toDateString(endDate: Date | string): string {
	return toIsoDate(endDate).slice(0, 10);
}

function collectPuzzles(set: TrainingPuzzle[], dealt: TrainingCalibrationPuzzle[]): Puzzle[] {
	const puzzles = new Map<string, Puzzle>();

	for (const row of [...set, ...dealt]) {
		puzzles.set(row.puzzle.lichessId, row.puzzle);
	}

	return [...puzzles.values()];
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
	const groups = new Map<string, T[]>();

	for (const row of rows) {
		const group = groups.get(key(row));

		if (undefined === group) {
			groups.set(key(row), [row]);
		} else {
			group.push(row);
		}
	}

	return groups;
}

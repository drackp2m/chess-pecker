import { EntityManager } from '@mikro-orm/core';

import { PuzzleAttempt } from '../../training/puzzle-attempt.entity';
import { TrainingCalibrationPuzzle } from '../../training/training-calibration-puzzle.entity';
import { TrainingCalibrationRound } from '../../training/training-calibration-round.entity';
import { TrainingCycleItem } from '../../training/training-cycle-item.entity';
import { TrainingCycle } from '../../training/training-cycle.entity';
import { TrainingGoal } from '../../training/training-goal.entity';
import { TrainingPuzzle } from '../../training/training-puzzle.entity';
import { Training } from '../../training/training.entity';
import { PushTrainingNodeDto } from '../dto/request/push-training-node.dto';

import { SyncKeys, SyncRowIndex, collectKey, loadRowIndex, noKeys } from './sync-row-index';

export interface SyncTreeRows {
	readonly training: SyncRowIndex<Training>;
	readonly trainingGoal: SyncRowIndex<TrainingGoal>;
	readonly trainingPuzzle: SyncRowIndex<TrainingPuzzle>;
	readonly calibrationRound: SyncRowIndex<TrainingCalibrationRound>;
	readonly calibrationPuzzle: SyncRowIndex<TrainingCalibrationPuzzle>;
	readonly cycle: SyncRowIndex<TrainingCycle>;
	readonly cycleItem: SyncRowIndex<TrainingCycleItem>;
	readonly attempt: SyncRowIndex<PuzzleAttempt>;
}

interface TreeKeys {
	readonly training: SyncKeys;
	readonly trainingGoal: SyncKeys;
	readonly trainingPuzzle: SyncKeys;
	readonly calibrationRound: SyncKeys;
	readonly calibrationPuzzle: SyncKeys;
	readonly cycle: SyncKeys;
	readonly cycleItem: SyncKeys;
	readonly attempt: SyncKeys;
}

export async function loadTreeRows(
	entityManager: EntityManager,
	node: PushTrainingNodeDto,
): Promise<SyncTreeRows> {
	const keys = collectTreeKeys(node);

	return {
		training: await loadRowIndex(entityManager, Training, keys.training),
		trainingGoal: await loadRowIndex(entityManager, TrainingGoal, keys.trainingGoal),
		trainingPuzzle: await loadRowIndex(entityManager, TrainingPuzzle, keys.trainingPuzzle),
		calibrationRound: await loadRowIndex(
			entityManager,
			TrainingCalibrationRound,
			keys.calibrationRound,
		),
		calibrationPuzzle: await loadRowIndex(
			entityManager,
			TrainingCalibrationPuzzle,
			keys.calibrationPuzzle,
		),
		cycle: await loadRowIndex(entityManager, TrainingCycle, keys.cycle),
		cycleItem: await loadRowIndex(entityManager, TrainingCycleItem, keys.cycleItem),
		attempt: await loadRowIndex(entityManager, PuzzleAttempt, keys.attempt),
	};
}

function collectTreeKeys(node: PushTrainingNodeDto): TreeKeys {
	const keys: TreeKeys = {
		training: noKeys(),
		trainingGoal: noKeys(),
		trainingPuzzle: noKeys(),
		calibrationRound: noKeys(),
		calibrationPuzzle: noKeys(),
		cycle: noKeys(),
		cycleItem: noKeys(),
		attempt: noKeys(),
	};

	collectKey(keys.training, node);

	for (const goal of node.goals) {
		collectKey(keys.trainingGoal, goal);
	}

	for (const puzzle of node.puzzles) {
		collectKey(keys.trainingPuzzle, puzzle);
	}

	collectRoundKeys(keys, node);
	collectCycleKeys(keys, node);

	return keys;
}

function collectRoundKeys(keys: TreeKeys, node: PushTrainingNodeDto): void {
	for (const round of node.rounds) {
		collectKey(keys.calibrationRound, round);

		for (const dealt of round.puzzles) {
			collectKey(keys.calibrationPuzzle, dealt);
		}

		for (const attempt of round.attempts) {
			collectKey(keys.attempt, attempt);
		}
	}
}

function collectCycleKeys(keys: TreeKeys, node: PushTrainingNodeDto): void {
	for (const cycle of node.cycles) {
		collectKey(keys.cycle, cycle);

		for (const item of cycle.items) {
			collectKey(keys.cycleItem, item);

			for (const attempt of item.attempts) {
				collectKey(keys.attempt, attempt);
			}
		}
	}
}

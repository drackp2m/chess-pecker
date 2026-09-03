import type {
	PushGoalNodeParsed,
	PushTrainingNodeParsed,
	PushTrainingPuzzleNodeParsed,
	PushTrainingRequestParsed,
	PushTrainingResult,
} from '@chesspecker/api-definitions';
import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { GenerateNowDateUseCase } from '../../../shared/use-case/generate-now-date.use-case';
import { TrainingGoal } from '../../training/training-goal.entity';
import { TrainingPuzzle } from '../../training/training-puzzle.entity';
import { Training } from '../../training/training.entity';
import { ApplySyncTimestampsUseCase } from '../../training/use-case/apply-sync-timestamps.use-case';
import { User } from '../../user/user.entity';
import { SyncPushContext } from '../definition/sync-push-context.interface';
import { SyncPushOutcome } from '../definition/sync-push-outcome';
import { claimSyncRow, isFresherNode, loadTreePuzzles, reuseSyncRow } from '../util/sync-node.util';
import { loadTreeRows } from '../util/sync-tree-rows.util';

import { PushCalibrationBranchUseCase } from './push-calibration-branch.use-case';
import { PushCycleBranchUseCase } from './push-cycle-branch.use-case';

/**
 * A training's whole tree, topologically ordered in one transaction: a child needs its
 * parent's final uuid. The server checks ownership, dates and constraints, not the flow.
 */
@Injectable()
export class PushTrainingTreeUseCase {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly pushCalibrationBranchUseCase: PushCalibrationBranchUseCase,
		private readonly pushCycleBranchUseCase: PushCycleBranchUseCase,
		private readonly applySyncTimestampsUseCase: ApplySyncTimestampsUseCase,
	) {}

	async execute(user: User, request: PushTrainingRequestParsed): Promise<PushTrainingResult> {
		const node = request.training;
		const receivedAt = new GenerateNowDateUseCase().execute();
		const outcome = new SyncPushOutcome(receivedAt);

		await this.entityManager.transactional(async (entityManager) => {
			const puzzles = await loadTreePuzzles(entityManager, node);
			const rows = await loadTreeRows(entityManager, node);
			const context: SyncPushContext = { entityManager, receivedAt, puzzles, rows, outcome };
			const training = this.pushTraining(context, user, node);

			this.pushGoals(context, training, node.goals);

			const set = await this.pushSet(context, training, node.puzzles);

			this.pushCalibrationBranchUseCase.execute(context, training, node.rounds);
			await this.pushCycleBranchUseCase.execute(context, training, node.cycles, set);
		});

		return outcome.toResult();
	}

	/** The gate: the tree belongs to whoever pushes it, and that is all that is checked. */
	private pushTraining(context: SyncPushContext, user: User, node: PushTrainingNodeParsed): Training {
		const existing = context.rows.training.find(node, 'training');

		if (undefined !== existing) {
			if (existing.user.uuid !== user.uuid) {
				throw new ForbiddenException('not allowed', 'training');
			}

			this.refreshTraining(existing, node);
			context.outcome.keep('training', node, existing.uuid);

			return existing;
		}

		return claimSyncRow(context, 'training', node, this.buildTraining(user, node));
	}

	/** Finishing or cancelling a training happens long after its tree went up. */
	private refreshTraining(row: Training, node: PushTrainingNodeParsed): void {
		if (!isFresherNode(node, row)) {
			return;
		}

		row.status = node.status;

		if (undefined !== node.finishedReason) {
			row.finishedReason = node.finishedReason;
		}

		if (undefined !== node.finishedAt) {
			row.finishedAt = node.finishedAt;
		}

		this.applySyncTimestampsUseCase.execute(row, node);
	}

	private buildTraining(user: User, node: PushTrainingNodeParsed): Training {
		return this.applySyncTimestampsUseCase.execute(
			new Training({
				user,
				status: node.status,
				...(undefined === node.finishedReason ? {} : { finishedReason: node.finishedReason }),
				...(undefined === node.finishedAt ? {} : { finishedAt: node.finishedAt }),
			}),
			node,
		);
	}

	private pushGoals(context: SyncPushContext, training: Training, nodes: PushGoalNodeParsed[]): void {
		for (const node of nodes) {
			this.pushGoal(context, training, node);
		}
	}

	private pushGoal(context: SyncPushContext, training: Training, node: PushGoalNodeParsed): void {
		const existing = context.rows.trainingGoal.find(node, 'trainingGoal');

		if (undefined !== existing) {
			const belongsHere = existing.training.uuid === training.uuid;

			reuseSyncRow(context, 'trainingGoal', node, existing, belongsHere, OTHER_TREE);

			return;
		}

		if (undefined === node.puzzlesPerDay && undefined === node.endDate) {
			context.outcome.reject('trainingGoal', node, 'puzzlesPerDay or endDate is required');

			return;
		}

		claimSyncRow(context, 'trainingGoal', node, this.buildGoal(training, node));
	}

	private buildGoal(training: Training, node: PushGoalNodeParsed): TrainingGoal {
		return this.applySyncTimestampsUseCase.execute(
			new TrainingGoal({
				training,
				...(undefined === node.puzzlesPerDay ? {} : { puzzlesPerDay: node.puzzlesPerDay }),
				...(undefined === node.endDate ? {} : { endDate: node.endDate }),
			}),
			node,
		);
	}

	/**
	 * The set, indexed both by server uuid and by retry key: a cycle slot may have been born
	 * before or after its exercise went up.
	 */
	private async pushSet(
		context: SyncPushContext,
		training: Training,
		nodes: PushTrainingPuzzleNodeParsed[],
	): Promise<Map<string, TrainingPuzzle>> {
		const stored = await context.entityManager.find(TrainingPuzzle, { training });
		const set = new Map<string, TrainingPuzzle>();

		for (const row of stored) {
			indexSetEntry(set, row);
		}

		for (const node of nodes) {
			const entry = this.pushSetEntry(context, training, node);

			if (undefined !== entry) {
				indexSetEntry(set, entry);
			}
		}

		return set;
	}

	private pushSetEntry(
		context: SyncPushContext,
		training: Training,
		node: PushTrainingPuzzleNodeParsed,
	): TrainingPuzzle | undefined {
		const existing = context.rows.trainingPuzzle.find(node, 'trainingPuzzle');

		if (undefined !== existing) {
			const belongsHere = existing.training.uuid === training.uuid;

			return reuseSyncRow(context, 'trainingPuzzle', node, existing, belongsHere, OTHER_TREE);
		}

		const puzzle = context.puzzles.get(node.lichessId);

		if (undefined === puzzle) {
			context.outcome.reject('trainingPuzzle', node, `unknown puzzle \`${node.lichessId}\``);

			return undefined;
		}

		const entry = this.applySyncTimestampsUseCase.execute(
			new TrainingPuzzle({ training, puzzle }),
			node,
		);

		return claimSyncRow(context, 'trainingPuzzle', node, entry);
	}
}

function indexSetEntry(set: Map<string, TrainingPuzzle>, entry: TrainingPuzzle): void {
	set.set(entry.uuid, entry);

	if (undefined !== entry.clientRef) {
		set.set(entry.clientRef, entry);
	}
}

const OTHER_TREE = 'belongs to another training';

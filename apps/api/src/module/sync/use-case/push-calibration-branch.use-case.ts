import type {
	PushCalibrationPuzzleNodeParsed,
	PushCalibrationRoundNodeParsed,
} from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { TrainingCalibrationPuzzle } from '../../training/training-calibration-puzzle.entity';
import { TrainingCalibrationRound } from '../../training/training-calibration-round.entity';
import { Training } from '../../training/training.entity';
import { ApplySyncTimestampsUseCase } from '../../training/use-case/apply-sync-timestamps.use-case';
import { SyncPushContext } from '../definition/sync-push-context.interface';
import { claimSyncRow, isFresherNode, reuseSyncRow } from '../util/sync-node.util';

import { PushSyncAttemptUseCase } from './push-sync-attempt.use-case';

/** The calibration branch: the rounds, what each dealt out, and what was played in them. */
@Injectable()
export class PushCalibrationBranchUseCase {
	constructor(
		private readonly pushSyncAttemptUseCase: PushSyncAttemptUseCase,
		private readonly applySyncTimestampsUseCase: ApplySyncTimestampsUseCase,
	) {}

	execute(
		context: SyncPushContext,
		training: Training,
		nodes: PushCalibrationRoundNodeParsed[],
	): void {
		for (const node of nodes) {
			const round = this.pushRound(context, training, node);

			if (undefined === round) {
				continue;
			}

			for (const dealt of node.puzzles) {
				this.pushDealt(context, round, dealt);
			}

			for (const attempt of node.attempts) {
				this.pushSyncAttemptUseCase.calibration(context, training, round, attempt);
			}
		}
	}

	private pushRound(
		context: SyncPushContext,
		training: Training,
		node: PushCalibrationRoundNodeParsed,
	): TrainingCalibrationRound | undefined {
		const existing = context.rows.calibrationRound.find(node, 'calibrationRound');

		if (undefined !== existing) {
			const belongsHere = existing.training.uuid === training.uuid;
			const reused = reuseSyncRow(
				context,
				'calibrationRound',
				node,
				existing,
				belongsHere,
				OTHER_TREE,
			);

			if (undefined !== reused) {
				this.refreshRound(reused, node);
			}

			return reused;
		}

		return claimSyncRow(context, 'calibrationRound', node, this.buildRound(training, node));
	}

	/** A round uploads open and decides afterwards: raise, lower, or accept the band. */
	private refreshRound(row: TrainingCalibrationRound, node: PushCalibrationRoundNodeParsed): void {
		if (!isFresherNode(node, row)) {
			return;
		}

		row.outcome = node.outcome;

		this.applySyncTimestampsUseCase.execute(row, node);
	}

	private buildRound(
		training: Training,
		node: PushCalibrationRoundNodeParsed,
	): TrainingCalibrationRound {
		return this.applySyncTimestampsUseCase.execute(
			new TrainingCalibrationRound({
				training,
				index: node.index,
				kind: node.kind,
				rating: node.rating,
				outcome: node.outcome,
			}),
			node,
		);
	}

	/** Which exercises the round dealt out, which is what makes it reconstructible. */
	private pushDealt(
		context: SyncPushContext,
		round: TrainingCalibrationRound,
		node: PushCalibrationPuzzleNodeParsed,
	): void {
		const existing = context.rows.calibrationPuzzle.find(node, 'calibrationPuzzle');

		if (undefined !== existing) {
			const belongsHere = existing.calibrationRound.uuid === round.uuid;

			reuseSyncRow(context, 'calibrationPuzzle', node, existing, belongsHere, OTHER_ROUND);

			return;
		}

		const puzzle = context.puzzles.get(node.lichessId);

		if (undefined === puzzle) {
			context.outcome.reject('calibrationPuzzle', node, `unknown puzzle \`${node.lichessId}\``);

			return;
		}

		const dealt = this.applySyncTimestampsUseCase.execute(
			new TrainingCalibrationPuzzle({ calibrationRound: round, puzzle, position: node.position }),
			node,
		);

		claimSyncRow(context, 'calibrationPuzzle', node, dealt);
	}
}

const OTHER_TREE = 'belongs to another training';
const OTHER_ROUND = 'belongs to another round';

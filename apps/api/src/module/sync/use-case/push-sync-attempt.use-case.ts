import { EntityData } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';

import { Puzzle } from '../../puzzle/puzzle.entity';
import { PuzzleAttemptKind } from '../../training/definition/puzzle-attempt-kind.enum';
import { PuzzleAttempt } from '../../training/puzzle-attempt.entity';
import { TrainingCalibrationRound } from '../../training/training-calibration-round.entity';
import { TrainingCycleItem } from '../../training/training-cycle-item.entity';
import { Training } from '../../training/training.entity';
import { ApplySyncTimestampsUseCase } from '../../training/use-case/apply-sync-timestamps.use-case';
import { SyncPushContext } from '../definition/sync-push-context.interface';
import { PushAttemptNodeDto } from '../dto/request/push-attempt-node.dto';
import { claimSyncRow, reuseSyncRow, syncKey } from '../util/sync-node.util';

/**
 * The attempt: the leaf of the tree, and the only table that grows without a ceiling. Its
 * kind comes from what it hangs off, so the table's `check` holds by construction.
 */
@Injectable()
export class PushSyncAttemptUseCase {
	constructor(private readonly applySyncTimestampsUseCase: ApplySyncTimestampsUseCase) {}

	async calibration(
		context: SyncPushContext,
		training: Training,
		round: TrainingCalibrationRound,
		node: PushAttemptNodeDto,
	): Promise<void> {
		await this.push(
			context,
			node,
			{ training, kind: PuzzleAttemptKind.Calibration, calibrationRound: round },
			(attempt) => attempt.calibrationRound?.uuid === round.uuid,
		);
	}

	async cycle(
		context: SyncPushContext,
		training: Training,
		item: TrainingCycleItem,
		node: PushAttemptNodeDto,
	): Promise<void> {
		await this.push(
			context,
			node,
			{ training, kind: PuzzleAttemptKind.Cycle, cycleItem: item },
			(attempt) => attempt.cycleItem?.uuid === item.uuid,
		);
	}

	private async push(
		context: SyncPushContext,
		node: PushAttemptNodeDto,
		parent: EntityData<PuzzleAttempt>,
		belongsHere: (attempt: PuzzleAttempt) => boolean,
	): Promise<void> {
		const existing = await context.entityManager.findOne(PuzzleAttempt, syncKey(node, 'attempt'));

		if (null !== existing) {
			reuseSyncRow(context, 'attempt', node, existing, belongsHere(existing), OTHER_SLOT);

			return;
		}

		const puzzle = context.puzzles.get(node.lichessId);

		if (undefined === puzzle) {
			context.outcome.reject('attempt', node, `unknown puzzle \`${node.lichessId}\``);

			return;
		}

		claimSyncRow(context, 'attempt', node, this.build(node, parent, puzzle));
	}

	private build(
		node: PushAttemptNodeDto,
		parent: EntityData<PuzzleAttempt>,
		puzzle: Puzzle,
	): PuzzleAttempt {
		return this.applySyncTimestampsUseCase.execute(
			new PuzzleAttempt({
				...parent,
				puzzle,
				durationMs: node.durationMs,
				solved: node.solved,
				closure: node.closure,
				hintUsed: node.hintUsed,
				mistakeCount: node.mistakeCount,
				record: node.record,
				explorations: node.explorations,
			}),
			node,
		);
	}
}

/**
 * The same slot solved on two devices. The server keeps the first; the second is not lost,
 * still being on its device, but it stops being retried.
 */
const OTHER_SLOT = 'belongs to another slot';

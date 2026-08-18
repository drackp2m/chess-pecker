import { Injectable } from '@nestjs/common';

import { TrainingCalibrationPuzzle } from '../../training/training-calibration-puzzle.entity';
import { TrainingCalibrationRound } from '../../training/training-calibration-round.entity';
import { Training } from '../../training/training.entity';
import { ApplySyncTimestampsUseCase } from '../../training/use-case/apply-sync-timestamps.use-case';
import { SyncPushContext } from '../definition/sync-push-context.interface';
import { PushCalibrationPuzzleNodeDto } from '../dto/request/push-calibration-puzzle-node.dto';
import { PushCalibrationRoundNodeDto } from '../dto/request/push-calibration-round-node.dto';
import { claimSyncRow, isFresherNode, reuseSyncRow, syncKey } from '../util/sync-node.util';

import { PushSyncAttemptUseCase } from './push-sync-attempt.use-case';

/** La rama de la calibración: las rondas, lo que repartió cada una y lo que se jugó en ella. */
@Injectable()
export class PushCalibrationBranchUseCase {
	constructor(
		private readonly pushSyncAttemptUseCase: PushSyncAttemptUseCase,
		private readonly applySyncTimestampsUseCase: ApplySyncTimestampsUseCase,
	) {}

	async execute(
		context: SyncPushContext,
		training: Training,
		nodes: PushCalibrationRoundNodeDto[],
	): Promise<void> {
		for (const node of nodes) {
			const round = await this.pushRound(context, training, node);

			if (undefined === round) {
				continue;
			}

			for (const dealt of node.puzzles) {
				await this.pushDealt(context, round, dealt);
			}

			for (const attempt of node.attempts) {
				await this.pushSyncAttemptUseCase.calibration(context, training, round, attempt);
			}
		}
	}

	private async pushRound(
		context: SyncPushContext,
		training: Training,
		node: PushCalibrationRoundNodeDto,
	): Promise<TrainingCalibrationRound | undefined> {
		const existing = await context.entityManager.findOne(
			TrainingCalibrationRound,
			syncKey(node, 'calibrationRound'),
		);

		if (null !== existing) {
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

	/** La ronda sube abierta y decide después: subir, bajar o aceptar la franja. */
	private refreshRound(row: TrainingCalibrationRound, node: PushCalibrationRoundNodeDto): void {
		if (!isFresherNode(node, row)) {
			return;
		}

		row.outcome = node.outcome;

		this.applySyncTimestampsUseCase.execute(row, node);
	}

	private buildRound(
		training: Training,
		node: PushCalibrationRoundNodeDto,
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

	/** Qué ejercicios se repartieron en la ronda, que es lo que la hace reconstruible. */
	private async pushDealt(
		context: SyncPushContext,
		round: TrainingCalibrationRound,
		node: PushCalibrationPuzzleNodeDto,
	): Promise<void> {
		const existing = await context.entityManager.findOne(
			TrainingCalibrationPuzzle,
			syncKey(node, 'calibrationPuzzle'),
		);

		if (null !== existing) {
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

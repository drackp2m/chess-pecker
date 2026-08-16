import { Injectable } from '@nestjs/common';

import { TrainingCycleItem } from '../../training/training-cycle-item.entity';
import { TrainingCycle } from '../../training/training-cycle.entity';
import { TrainingPuzzle } from '../../training/training-puzzle.entity';
import { Training } from '../../training/training.entity';
import { ApplySyncTimestampsUseCase } from '../../training/use-case/apply-sync-timestamps.use-case';
import { SyncPushContext } from '../definition/sync-push-context.interface';
import { PushCycleItemNodeDto } from '../dto/request/push-cycle-item-node.dto';
import { PushCycleNodeDto } from '../dto/request/push-cycle-node.dto';
import { claimSyncRow, reuseSyncRow, syncKey } from '../util/sync-node.util';

import { PushSyncAttemptUseCase } from './push-sync-attempt.use-case';

/** La rama de las pasadas: los ciclos, el orden que fijaron y lo que se jugó en cada hueco. */
@Injectable()
export class PushCycleBranchUseCase {
	constructor(
		private readonly pushSyncAttemptUseCase: PushSyncAttemptUseCase,
		private readonly applySyncTimestampsUseCase: ApplySyncTimestampsUseCase,
	) {}

	async execute(
		context: SyncPushContext,
		training: Training,
		nodes: PushCycleNodeDto[],
		set: ReadonlyMap<string, TrainingPuzzle>,
	): Promise<void> {
		for (const node of nodes) {
			const cycle = await this.pushCycle(context, training, node);

			if (undefined === cycle) {
				continue;
			}

			for (const itemNode of node.items) {
				await this.pushItem(context, training, cycle, itemNode, set);
			}
		}
	}

	private async pushCycle(
		context: SyncPushContext,
		training: Training,
		node: PushCycleNodeDto,
	): Promise<TrainingCycle | undefined> {
		const existing = await context.entityManager.findOne(TrainingCycle, syncKey(node, 'cycle'));

		if (null !== existing) {
			const belongsHere = existing.training.uuid === training.uuid;

			return reuseSyncRow(context, 'cycle', node, existing, belongsHere, OTHER_TREE);
		}

		const cycle = this.applySyncTimestampsUseCase.execute(
			new TrainingCycle({ training, index: node.index, status: node.status }),
			node,
		);

		return claimSyncRow(context, 'cycle', node, cycle);
	}

	private async pushItem(
		context: SyncPushContext,
		training: Training,
		cycle: TrainingCycle,
		node: PushCycleItemNodeDto,
		set: ReadonlyMap<string, TrainingPuzzle>,
	): Promise<void> {
		const item = await this.resolveItem(context, cycle, node, set);

		if (undefined === item) {
			return;
		}

		for (const attempt of node.attempts) {
			await this.pushSyncAttemptUseCase.cycle(context, training, item, attempt);
		}
	}

	/**
	 * El hueco necesita el ejercicio del set ya resuelto: si esa rama se rechazó —porque su
	 * ejercicio no está en el catálogo—, el hueco se va detrás y sus intentos con él.
	 */
	private async resolveItem(
		context: SyncPushContext,
		cycle: TrainingCycle,
		node: PushCycleItemNodeDto,
		set: ReadonlyMap<string, TrainingPuzzle>,
	): Promise<TrainingCycleItem | undefined> {
		const existing = await context.entityManager.findOne(
			TrainingCycleItem,
			syncKey(node, 'cycleItem'),
		);

		if (null !== existing) {
			const belongsHere = existing.cycle.uuid === cycle.uuid;

			return reuseSyncRow(context, 'cycleItem', node, existing, belongsHere, OTHER_CYCLE);
		}

		const trainingPuzzle = set.get(node.trainingPuzzleRef);

		if (undefined === trainingPuzzle) {
			context.outcome.reject('cycleItem', node, `unknown set entry \`${node.trainingPuzzleRef}\``);

			return undefined;
		}

		const item = this.applySyncTimestampsUseCase.execute(
			new TrainingCycleItem({ cycle, trainingPuzzle, position: node.position }),
			node,
		);

		return claimSyncRow(context, 'cycleItem', node, item);
	}
}

const OTHER_TREE = 'belongs to another training';
const OTHER_CYCLE = 'belongs to another cycle';

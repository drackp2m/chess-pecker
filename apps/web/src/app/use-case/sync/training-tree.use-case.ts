import { Injectable, inject } from '@angular/core';
import type {
	PushCalibrationPuzzleNode,
	PushCalibrationRoundNode,
	PushCycleNode,
	PushGoalNode,
	PushTrainingNode,
	PushTrainingRequest,
} from '@chesspecker/api-definitions';
import { StoreNames } from 'idb';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import {
	CalibrationRoundRow,
	TrainingPuzzleRow,
	TrainingRow,
} from '@app/repository/definition/training-schema.interface';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { isRejected } from '@app/use-case/sync/local-record';
import {
	SyncManifest,
	SyncManifestBuilder,
	isWaiting,
	syncNode,
	travels,
} from '@app/use-case/sync/sync-manifest';
import {
	AttemptIndex,
	attemptNodes,
	groupAttempts,
	itemNodes,
	setNodes,
	setRefs,
} from '@app/use-case/sync/tree-nodes';
import { pendingTrainings } from '@app/use-case/sync/tree-owners';

/** A tree ready to push, with the list its response will have to confirm. */
export interface TrainingTreePush {
	readonly trainingUuid: string;
	readonly request: PushTrainingRequest;
	readonly manifest: SyncManifest;
}

const PENDING_STORES: StoreNames<AppSchema>[] = [...SYNC_ENTITIES];

/**
 * A training's tree as it travels: the branches holding something to push, and above them
 * only the parents those need to be named by. A row already up says nothing the server does
 * not know, and sending it made every push re-walk the whole history to learn that.
 */
@Injectable({
	providedIn: 'root',
})
export class TrainingTreeUseCase {
	private readonly repository = inject(LocalDataRepository);

	/** The trainings with something to push, read straight off the pending index. */
	async listPending(): Promise<readonly string[]> {
		return this.repository.runInTransaction(PENDING_STORES, 'readonly', (transaction) =>
			pendingTrainings(transaction),
		);
	}

	/** `undefined` when the tree has nothing left to push, or was refused whole. */
	async build(trainingUuid: string): Promise<TrainingTreePush | undefined> {
		const training = await this.repository.find('training', trainingUuid);

		if (undefined === training || isRejected(training)) {
			return undefined;
		}

		const manifest = new SyncManifestBuilder();
		const request: PushTrainingRequest = { training: await this.trainingNode(manifest, training) };

		if (0 === manifest.pending) {
			return undefined;
		}

		return { trainingUuid, request, manifest: manifest.build() };
	}

	private async trainingNode(
		manifest: SyncManifestBuilder,
		training: TrainingRow,
	): Promise<PushTrainingNode> {
		const uuid = training.uuid;
		const set = await this.repository.findAllByIndex('trainingPuzzle', 'trainingUuid', uuid);
		const attempts = groupAttempts(
			await this.repository.findAllByIndex('attempt', 'trainingUuid', uuid),
		);

		manifest.add('training', training);

		return {
			...syncNode(training),
			status: training.status,
			...(undefined === training.finishedReason ? {} : { finishedReason: training.finishedReason }),
			...(undefined === training.finishedAt
				? {}
				: { finishedAt: training.finishedAt.toISOString() }),
			goals: await this.goalNodes(manifest, uuid),
			rounds: await this.roundNodes(manifest, uuid, attempts.byRound),
			puzzles: setNodes(manifest, set),
			cycles: await this.cycleNodes(manifest, uuid, set, attempts.byItem),
		};
	}

	private async goalNodes(
		manifest: SyncManifestBuilder,
		trainingUuid: string,
	): Promise<PushGoalNode[]> {
		const rows = await this.repository.findAllByIndex('trainingGoal', 'trainingUuid', trainingUuid);
		const nodes: PushGoalNode[] = [];

		for (const row of rows) {
			if (!isWaiting(row) || !manifest.add('trainingGoal', row)) {
				continue;
			}

			nodes.push({
				...syncNode(row),
				...(undefined === row.puzzlesPerDay ? {} : { puzzlesPerDay: row.puzzlesPerDay }),
				...(undefined === row.endDate ? {} : { endDate: row.endDate }),
			});
		}

		return nodes;
	}

	private async roundNodes(
		manifest: SyncManifestBuilder,
		trainingUuid: string,
		byRound: AttemptIndex,
	): Promise<PushCalibrationRoundNode[]> {
		const rows = await this.repository.findAllByIndex(
			'calibrationRound',
			'trainingUuid',
			trainingUuid,
		);
		const nodes: PushCalibrationRoundNode[] = [];

		for (const row of rows) {
			const node = await this.roundNode(manifest, row, byRound);

			if (undefined !== node) {
				nodes.push(node);
			}
		}

		return nodes;
	}

	private async roundNode(
		manifest: SyncManifestBuilder,
		row: CalibrationRoundRow,
		byRound: AttemptIndex,
	): Promise<PushCalibrationRoundNode | undefined> {
		if (isRejected(row) || !manifest.add('calibrationRound', row)) {
			return undefined;
		}

		const puzzles = await this.dealtNodes(manifest, row.uuid);
		const attempts = attemptNodes(manifest, byRound.get(row.uuid));

		if (!travels(row, puzzles, attempts)) {
			return undefined;
		}

		return {
			...syncNode(row),
			index: row.index,
			kind: row.kind,
			rating: row.rating,
			outcome: row.outcome,
			puzzles,
			attempts,
		};
	}

	private async dealtNodes(
		manifest: SyncManifestBuilder,
		roundUuid: string,
	): Promise<PushCalibrationPuzzleNode[]> {
		const rows = await this.repository.findAllByIndex('calibrationPuzzle', 'roundUuid', roundUuid);
		const nodes: PushCalibrationPuzzleNode[] = [];

		for (const row of rows) {
			if (!isWaiting(row) || !manifest.add('calibrationPuzzle', row)) {
				continue;
			}

			nodes.push({ ...syncNode(row), lichessId: row.lichessId, position: row.position });
		}

		return nodes;
	}

	private async cycleNodes(
		manifest: SyncManifestBuilder,
		trainingUuid: string,
		set: readonly TrainingPuzzleRow[],
		byItem: AttemptIndex,
	): Promise<PushCycleNode[]> {
		const rows = await this.repository.findAllByIndex('cycle', 'trainingUuid', trainingUuid);
		const refs = setRefs(set);
		const nodes: PushCycleNode[] = [];

		for (const row of rows) {
			if (isRejected(row) || !manifest.add('cycle', row)) {
				continue;
			}

			const stored = await this.repository.findAllByIndex('cycleItem', 'cycleUuid', row.uuid);
			const items = itemNodes(manifest, stored, refs, byItem);

			if (!travels(row, items)) {
				continue;
			}

			nodes.push({
				...syncNode(row),
				index: row.index,
				status: row.status,
				itemCount: row.expectedItems ?? stored.length,
				items,
			});
		}

		return nodes;
	}
}

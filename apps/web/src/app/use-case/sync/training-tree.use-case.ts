import { Injectable, inject } from '@angular/core';
import type {
	PushAttemptNode,
	PushCalibrationPuzzleNode,
	PushCalibrationRoundNode,
	PushCycleItemNode,
	PushCycleNode,
	PushGoalNode,
	PushTrainingNode,
	PushTrainingPuzzleNode,
	PushTrainingRequest,
	SyncEntity,
} from '@chesspecker/api-definitions';
import { StoreNames } from 'idb';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { PendingRow, PendingStore } from '@app/repository/definition/pending-schema.interface';
import {
	TrainingPuzzleRow,
	TrainingRow,
} from '@app/repository/definition/training-schema.interface';
import { RepositoryTransaction } from '@app/repository/generic.repository';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { isRejected } from '@app/use-case/sync/local-record';
import {
	SyncManifest,
	SyncManifestBuilder,
	syncNode,
	syncRef,
} from '@app/use-case/sync/sync-manifest';

/** A tree ready to push, with the list its response will have to confirm. */
export interface TrainingTreePush {
	readonly trainingUuid: string;
	readonly request: PushTrainingRequest;
	readonly manifest: SyncManifest;
}

type PendingTransaction = RepositoryTransaction<AppSchema, 'readonly'>;

/** A tree's attempts grouped by the slot they fill, which is where they will travel. */
type AttemptIndex = ReadonlyMap<string, AttemptRow[]>;

interface PendingOwners {
	readonly trainings: Set<string>;
	readonly rounds: Set<string>;
	readonly cycles: Set<string>;
}

const PENDING_STORES: StoreNames<AppSchema>[] = [...SYNC_ENTITIES];

/**
 * A training's tree as it travels: the whole thing, even for one pending leaf, because a
 * child needs its parent's final uuid and separate requests would need ordering from outside.
 */
@Injectable({
	providedIn: 'root',
})
export class TrainingTreeUseCase {
	private readonly repository = inject(LocalDataRepository);

	/**
	 * The trainings with something to push. The pending index *is* the list, since IndexedDB
	 * does not index rows missing the field, so this walks nothing else.
	 */
	async listPending(): Promise<readonly string[]> {
		return this.repository.runInTransaction(PENDING_STORES, 'readonly', async (transaction) => {
			const owners: PendingOwners = {
				trainings: new Set(),
				rounds: new Set(),
				cycles: new Set(),
			};

			for (const entity of SYNC_ENTITIES) {
				for (const row of await pendingRows(transaction, entity)) {
					collectOwner(entity, row, owners);
				}
			}

			// Deals and cycle slots do not name their training: they hang off the round and the
			// cycle, which do.
			await resolveOwners(transaction, 'calibrationRound', owners.rounds, owners.trainings);
			await resolveOwners(transaction, 'cycle', owners.cycles, owners.trainings);

			return [...owners.trainings];
		});
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
			if (isRejected(row) || !manifest.add('trainingGoal', row)) {
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
			if (isRejected(row) || !manifest.add('calibrationRound', row)) {
				continue;
			}

			nodes.push({
				...syncNode(row),
				index: row.index,
				kind: row.kind,
				rating: row.rating,
				outcome: row.outcome,
				puzzles: await this.dealtNodes(manifest, row.uuid),
				attempts: attemptNodes(manifest, byRound.get(row.uuid)),
			});
		}

		return nodes;
	}

	private async dealtNodes(
		manifest: SyncManifestBuilder,
		roundUuid: string,
	): Promise<PushCalibrationPuzzleNode[]> {
		const rows = await this.repository.findAllByIndex('calibrationPuzzle', 'roundUuid', roundUuid);
		const nodes: PushCalibrationPuzzleNode[] = [];

		for (const row of rows) {
			if (isRejected(row) || !manifest.add('calibrationPuzzle', row)) {
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

			nodes.push({
				...syncNode(row),
				index: row.index,
				status: row.status,
				items: await this.itemNodes(manifest, row.uuid, refs, byItem),
			});
		}

		return nodes;
	}

	private async itemNodes(
		manifest: SyncManifestBuilder,
		cycleUuid: string,
		refs: ReadonlyMap<string, string>,
		byItem: AttemptIndex,
	): Promise<PushCycleItemNode[]> {
		const rows = await this.repository.findAllByIndex('cycleItem', 'cycleUuid', cycleUuid);
		const nodes: PushCycleItemNode[] = [];

		for (const row of rows) {
			const trainingPuzzleRef = refs.get(row.trainingPuzzleUuid);

			// Without the set exercise it points at, the slot cannot be named.
			if (isRejected(row) || undefined === trainingPuzzleRef || !manifest.add('cycleItem', row)) {
				continue;
			}

			nodes.push({
				...syncNode(row),
				trainingPuzzleRef,
				position: row.position,
				attempts: attemptNodes(manifest, byItem.get(row.uuid)),
			});
		}

		return nodes;
	}
}

function setNodes(
	manifest: SyncManifestBuilder,
	rows: readonly TrainingPuzzleRow[],
): PushTrainingPuzzleNode[] {
	const nodes: PushTrainingPuzzleNode[] = [];

	for (const row of rows) {
		if (isRejected(row) || !manifest.add('trainingPuzzle', row)) {
			continue;
		}

		nodes.push({ ...syncNode(row), lichessId: row.lichessId });
	}

	return nodes;
}

/** How cycle slots name their set exercise, which lives on the tree's other branch. */
function setRefs(rows: readonly TrainingPuzzleRow[]): Map<string, string> {
	const refs = new Map<string, string>();

	for (const row of rows) {
		if (!isRejected(row)) {
			refs.set(row.uuid, syncRef(row));
		}
	}

	return refs;
}

/**
 * An attempt does not say what kind it is, where it hangs does, so they are grouped once by
 * slot instead of walking the whole history per round and per cycle slot.
 */
function groupAttempts(attempts: readonly AttemptRow[]): {
	byRound: AttemptIndex;
	byItem: AttemptIndex;
} {
	const byRound = new Map<string, AttemptRow[]>();
	const byItem = new Map<string, AttemptRow[]>();

	for (const row of attempts) {
		const parent = row.cycleItemUuid ?? row.roundUuid;
		const index = undefined === row.cycleItemUuid ? byRound : byItem;

		if (undefined !== parent) {
			const group = index.get(parent);

			if (undefined === group) {
				index.set(parent, [row]);
			} else {
				group.push(row);
			}
		}
	}

	return { byRound, byItem };
}

function attemptNodes(
	manifest: SyncManifestBuilder,
	attempts: readonly AttemptRow[] = [],
): PushAttemptNode[] {
	const nodes: PushAttemptNode[] = [];

	for (const row of attempts) {
		if (isRejected(row) || !manifest.add('attempt', row)) {
			continue;
		}

		nodes.push({
			...syncNode(row),
			lichessId: row.lichessId,
			durationMs: row.durationMs,
			solved: row.solved,
			closure: row.closure,
			hintUsed: row.hintUsed,
			mistakeCount: row.mistakeCount,
			record: [...row.record],
			explorations: row.explorations.map((run) => ({ at: run.at, events: [...run.events] })),
		});
	}

	return nodes;
}

async function pendingRows(
	transaction: PendingTransaction,
	entity: SyncEntity,
): Promise<PendingRow[]> {
	const store = transaction.objectStore(entity) as unknown as PendingStore<'readonly'>;

	return store.index('pendingSince').getAll();
}

function collectOwner(entity: SyncEntity, row: PendingRow, owners: PendingOwners): void {
	if ('training' === entity) {
		owners.trainings.add(row.uuid);

		return;
	}

	if (undefined !== row.trainingUuid) {
		owners.trainings.add(row.trainingUuid);

		return;
	}

	if (undefined !== row.roundUuid) {
		owners.rounds.add(row.roundUuid);

		return;
	}

	if (undefined !== row.cycleUuid) {
		owners.cycles.add(row.cycleUuid);
	}
}

async function resolveOwners(
	transaction: PendingTransaction,
	entity: 'calibrationRound' | 'cycle',
	keys: ReadonlySet<string>,
	trainings: Set<string>,
): Promise<void> {
	const store = transaction.objectStore(entity) as unknown as PendingStore<'readonly'>;

	for (const key of keys) {
		const row = await store.get(key);

		if (undefined !== row?.trainingUuid) {
			trainings.add(row.trainingUuid);
		}
	}
}

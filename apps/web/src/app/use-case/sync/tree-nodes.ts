import type {
	PushAttemptNode,
	PushCycleItemNode,
	PushTrainingPuzzleNode,
} from '@chesspecker/api-definitions';

import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import {
	CycleItemRow,
	TrainingPuzzleRow,
} from '@app/repository/definition/training-schema.interface';
import { isRejected } from '@app/use-case/sync/local-record';
import {
	SyncManifestBuilder,
	attemptWeight,
	isWaiting,
	syncNode,
	syncRef,
	travels,
} from '@app/use-case/sync/sync-manifest';

/** A tree's attempts grouped by the slot they fill, which is where they will travel. */
export type AttemptIndex = ReadonlyMap<string, AttemptRow[]>;

export function itemNodes(
	manifest: SyncManifestBuilder,
	rows: readonly CycleItemRow[],
	refs: ReadonlyMap<string, string>,
	byItem: AttemptIndex,
): PushCycleItemNode[] {
	const nodes: PushCycleItemNode[] = [];

	for (const row of rows) {
		const trainingPuzzleRef = refs.get(row.trainingPuzzleUuid);

		// Without the set exercise it points at, the slot cannot be named.
		if (isRejected(row) || undefined === trainingPuzzleRef || !manifest.add('cycleItem', row)) {
			continue;
		}

		const attempts = attemptNodes(manifest, byItem.get(row.uuid));

		if (!travels(row, attempts)) {
			continue;
		}

		nodes.push({
			...syncNode(row),
			trainingPuzzleRef,
			position: row.position,
			attempts,
		});
	}

	return nodes;
}

export function setNodes(
	manifest: SyncManifestBuilder,
	rows: readonly TrainingPuzzleRow[],
): PushTrainingPuzzleNode[] {
	const nodes: PushTrainingPuzzleNode[] = [];

	for (const row of rows) {
		if (!isWaiting(row) || !manifest.add('trainingPuzzle', row)) {
			continue;
		}

		nodes.push({ ...syncNode(row), lichessId: row.lichessId });
	}

	return nodes;
}

/** How cycle slots name their set exercise, which lives on the tree's other branch. */
export function setRefs(rows: readonly TrainingPuzzleRow[]): Map<string, string> {
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
export function groupAttempts(attempts: readonly AttemptRow[]): {
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

export function attemptNodes(
	manifest: SyncManifestBuilder,
	attempts: readonly AttemptRow[] = [],
): PushAttemptNode[] {
	const nodes: PushAttemptNode[] = [];

	for (const row of attempts) {
		if (!isWaiting(row) || !manifest.add('attempt', row, attemptWeight(row))) {
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
			freePlayRuns: row.freePlayRuns.map((run) => ({ at: run.at, events: [...run.events] })),
		});
	}

	return nodes;
}

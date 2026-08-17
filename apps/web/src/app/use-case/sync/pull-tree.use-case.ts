import { Injectable, inject } from '@angular/core';
import type {
	ApiPuzzle,
	PushTrainingResult,
	SyncEntity,
	SyncTrainingTree,
	SyncTreeRow,
} from '@chesspecker/api-definitions';
import { StoreNames } from 'idb';

import { TREE_SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { SyncRepository } from '@app/repository/sync.repository';
import { PuzzleCacheUseCase } from '@app/use-case/puzzle-cache.use-case';
import { PullTransaction, absorbRow, absorbRows } from '@app/use-case/sync/pull-writer';
import { RekeyUseCase } from '@app/use-case/sync/rekey.use-case';
import { PuzzleIndex, TrainingMirrorUseCase } from '@app/use-case/training-mirror.use-case';

type Remap = PushTrainingResult['uuids'];

const TREE_STORES: StoreNames<AppSchema>[] = [...TREE_SYNC_ENTITIES];

@Injectable({
	providedIn: 'root',
})
export class PullTreeUseCase {
	private readonly remote = inject(SyncRepository);
	private readonly repository = inject(LocalDataRepository);
	private readonly mirror = inject(TrainingMirrorUseCase);
	private readonly puzzleCache = inject(PuzzleCacheUseCase);
	private readonly rekey = inject(RekeyUseCase);

	async execute(trainingUuid: string, since?: string): Promise<number> {
		const tree = await this.remote.getTrainingTree(trainingUuid, since);

		await this.puzzleCache.save(tree.puzzles);
		await this.rekey.execute(await this.localTrainingUuid(tree), toRemap(tree));

		return this.absorb(tree);
	}

	private async localTrainingUuid(tree: SyncTrainingTree): Promise<string> {
		const clientRef = tree.training.clientRef;

		if (undefined === clientRef) {
			return tree.training.uuid;
		}

		const stored = await this.repository.find('training', clientRef);

		return undefined === stored ? tree.training.uuid : clientRef;
	}

	private async absorb(tree: SyncTrainingTree): Promise<number> {
		const uuid = tree.training.uuid;
		const puzzles = toPuzzleIndex(tree.puzzles);

		return this.repository.runInTransaction(TREE_STORES, 'readwrite', async (transaction) => {
			let written = await absorbRow(transaction, 'training', this.mirror.training(tree.training));

			written += await absorbRows(
				transaction,
				'trainingGoal',
				tree.goals.map((node) => this.mirror.goal(uuid, node)),
			);
			written += await absorbRows(
				transaction,
				'trainingPuzzle',
				tree.set.map((node) => this.mirror.setEntry(uuid, node, puzzles)),
			);
			written += await this.absorbRounds(transaction, tree);
			written += await this.absorbCycles(transaction, tree);

			return written;
		});
	}

	private async absorbRounds(
		transaction: PullTransaction,
		tree: SyncTrainingTree,
	): Promise<number> {
		let written = 0;

		for (const node of tree.rounds) {
			written += await absorbRow(
				transaction,
				'calibrationRound',
				this.mirror.round(tree.training.uuid, node),
			);
			written += await absorbRows(
				transaction,
				'calibrationPuzzle',
				node.puzzles.map((dealt) => this.mirror.dealt(node.uuid, dealt)),
			);
		}

		return written;
	}

	private async absorbCycles(
		transaction: PullTransaction,
		tree: SyncTrainingTree,
	): Promise<number> {
		let written = 0;

		for (const node of tree.cycles) {
			written += await absorbRow(transaction, 'cycle', this.mirror.cycle(tree.training.uuid, node));
			written += await absorbRows(
				transaction,
				'cycleItem',
				node.items.map((item) => this.mirror.cycleItem(node.uuid, item)),
			);
		}

		return written;
	}
}

function toPuzzleIndex(puzzles: readonly ApiPuzzle[]): PuzzleIndex {
	return new Map(puzzles.map((puzzle) => [puzzle.lichessId, puzzle]));
}

function toRemap(tree: SyncTrainingTree): Remap {
	const remap: Remap = {
		training: {},
		trainingGoal: {},
		calibrationRound: {},
		calibrationPuzzle: {},
		trainingPuzzle: {},
		cycle: {},
		cycleItem: {},
		attempt: {},
	};

	claim(remap, 'training', [tree.training]);
	claim(remap, 'trainingGoal', tree.goals);
	claim(remap, 'calibrationRound', tree.rounds);
	claim(remap, 'trainingPuzzle', tree.set);
	claim(remap, 'cycle', tree.cycles);

	for (const round of tree.rounds) {
		claim(remap, 'calibrationPuzzle', round.puzzles);
	}

	for (const cycle of tree.cycles) {
		claim(remap, 'cycleItem', cycle.items);
	}

	return remap;
}

function claim(remap: Remap, entity: SyncEntity, nodes: readonly SyncTreeRow[]): void {
	for (const node of nodes) {
		if (undefined !== node.clientRef) {
			remap[entity][node.clientRef] = node.uuid;
		}
	}
}

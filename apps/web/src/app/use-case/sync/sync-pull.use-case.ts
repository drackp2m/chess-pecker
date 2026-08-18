import { Injectable, inject } from '@angular/core';
import type { SyncSummary } from '@chesspecker/api-definitions';

import { SYNC_ENTITIES, TREE_SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { SyncCursorRepository } from '@app/repository/sync-cursor.repository';
import { TrainingRepository } from '@app/repository/training.repository';
import { PullTreeUseCase } from '@app/use-case/sync/pull-tree.use-case';
import { SyncStatus } from '@app/use-case/sync/sync-summary.use-case';
import { TrainingRestoreUseCase } from '@app/use-case/training-restore.use-case';

export interface SyncPullReport {
	readonly trainings: number;
	readonly rows: number;
	readonly interrupted: boolean;
}

interface Wanted {
	readonly tree: boolean;
	readonly attempts: boolean;
	readonly since: string | undefined;
}

type PullState = 'done' | 'partial' | 'unreachable';

interface PullOutcome {
	readonly rows: number;
	readonly state: PullState;
}

const NOTHING_PULLED: SyncPullReport = { trainings: 0, rows: 0, interrupted: false };

@Injectable({
	providedIn: 'root',
})
export class SyncPullUseCase {
	private readonly trainings = inject(TrainingRepository);
	private readonly trees = inject(PullTreeUseCase);
	private readonly restore = inject(TrainingRestoreUseCase);
	private readonly cursors = inject(SyncCursorRepository);

	async execute(status: SyncStatus): Promise<SyncPullReport> {
		const wanted = toWanted(status);

		if (!wanted.tree && !wanted.attempts) {
			return NOTHING_PULLED;
		}

		const listed = await this.list();

		if (undefined === listed) {
			return { ...NOTHING_PULLED, interrupted: true };
		}

		const report = await this.pullEach(listed, wanted);

		if (!report.interrupted) {
			await this.advanceCursors(status.summary);
		}

		return report;
	}

	private async list(): Promise<readonly string[] | undefined> {
		try {
			return (await this.trainings.list()).map((training) => training.uuid);
		} catch {
			return undefined;
		}
	}

	private async pullEach(uuids: readonly string[], wanted: Wanted): Promise<SyncPullReport> {
		let rows = 0;
		let trainings = 0;
		let interrupted = false;

		for (const uuid of uuids) {
			const outcome = await this.pullOne(uuid, wanted);

			rows += outcome.rows;
			trainings += 'unreachable' === outcome.state ? 0 : 1;
			interrupted = interrupted || 'done' !== outcome.state;

			if ('unreachable' === outcome.state) {
				break;
			}
		}

		return { trainings, rows, interrupted };
	}

	private async pullOne(uuid: string, wanted: Wanted): Promise<PullOutcome> {
		let rows = 0;

		if (wanted.tree) {
			try {
				rows = await this.trees.execute(uuid, wanted.since);
			} catch {
				return { rows: 0, state: 'unreachable' };
			}
		}

		if (wanted.attempts && !(await this.restore.execute(uuid))) {
			return { rows, state: 'partial' };
		}

		return { rows, state: 'done' };
	}

	private async advanceCursors(summary: SyncSummary): Promise<void> {
		for (const entity of SYNC_ENTITIES) {
			const { cursor, count } = summary.entities[entity];

			await this.cursors.saveCursor(entity, { cursor, count });
		}
	}
}

function toWanted(status: SyncStatus): Wanted {
	return {
		tree: TREE_SYNC_ENTITIES.some((entity) => status.behind.includes(entity)),
		attempts: status.behind.includes('attempt'),
		since: status.treeCursor,
	};
}

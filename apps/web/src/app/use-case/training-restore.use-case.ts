import { Injectable, inject } from '@angular/core';
import type { TrainingAttempt } from '@chesspecker/api-definitions';

import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { TrainingRepository } from '@app/repository/training.repository';
import { PuzzleCacheUseCase } from '@app/use-case/puzzle-cache.use-case';

/** Pages per visit: an empty device finishes filling up on the next one. */
const MAX_PAGES = 20;

/**
 * Pulls back the history this device lacks, filling gaps only, since local always wins. An
 * attempt is recognised by the plan slot it fills: matching on uuid would duplicate.
 */
@Injectable({
	providedIn: 'root',
})
export class TrainingRestoreUseCase {
	private readonly remote = inject(TrainingRepository);
	private readonly repository = inject(TrainingLocalRepository);
	private readonly puzzleCache = inject(PuzzleCacheUseCase);

	/**
	 * Silent on purpose: a failed restore must not bring the sync cycle down. Returns whether
	 * the history came out whole, which is what lets the global `attempt` cut move forward.
	 */
	async execute(trainingUuid: string): Promise<boolean> {
		return this.download(trainingUuid).catch(() => false);
	}

	private async download(trainingUuid: string): Promise<boolean> {
		let since = (await this.repository.find('attemptCursor', trainingUuid))?.cursor;

		for (let page = 0; page < MAX_PAGES; page += 1) {
			const history = await this.remote.listAttempts(
				trainingUuid,
				undefined === since ? {} : { since },
			);

			await this.puzzleCache.save(history.attempts.map((attempt) => attempt.puzzle));
			await this.absorb(trainingUuid, history.attempts);

			since = history.cursor;

			await this.repository.insert('attemptCursor', {
				trainingUuid,
				cursor: history.cursor,
				updatedAt: new Date(),
			});

			if (!history.hasMore) {
				return true;
			}
		}

		return false;
	}

	private async absorb(trainingUuid: string, attempts: readonly TrainingAttempt[]): Promise<void> {
		for (const attempt of attempts) {
			const row = this.toRow(trainingUuid, attempt);
			const stored = await this.findBySlot(row);

			if (undefined === stored) {
				await this.repository.insert('attempt', row);

				continue;
			}

			// Nothing here is overwritten, but a gap is filled: a row written before the server
			// sent the position never knew it.
			if (undefined === stored.position && undefined !== row.position) {
				await this.repository.insert('attempt', { ...stored, position: row.position });
			}
		}
	}

	private async findBySlot(row: AttemptRow): Promise<AttemptRow | undefined> {
		if (undefined !== row.cycleItemUuid) {
			return this.repository.findByIndex('attempt', 'cycleItemUuid', row.cycleItemUuid);
		}

		if (undefined === row.roundUuid) {
			return undefined;
		}

		return this.repository.findByIndex('attempt', 'roundUuid-puzzleUuid', [
			row.roundUuid,
			row.puzzleUuid,
		]);
	}

	private toRow(trainingUuid: string, attempt: TrainingAttempt): AttemptRow {
		const identity = {
			trainingUuid,
			kind: attempt.kind,
			puzzleUuid: attempt.puzzle.uuid,
			lichessId: attempt.puzzle.lichessId,
			...(undefined === attempt.roundUuid ? {} : { roundUuid: attempt.roundUuid }),
			...(undefined === attempt.cycleItemUuid ? {} : { cycleItemUuid: attempt.cycleItemUuid }),
		};

		return {
			...identity,
			uuid: attempt.uuid,
			durationMs: attempt.durationMs,
			record: attempt.record,
			explorations: attempt.explorations,
			solved: attempt.solved,
			closure: attempt.closure,
			hintUsed: attempt.hintUsed,
			mistakeCount: attempt.mistakeCount,
			createdAt: new Date(attempt.createdAt),
			updatedAt: new Date(attempt.updatedAt),
			...(undefined === attempt.position ? {} : { position: attempt.position }),
			// It came from the server, so it is never the only copy: it does not count as pending.
			syncedAt: new Date(),
		};
	}
}

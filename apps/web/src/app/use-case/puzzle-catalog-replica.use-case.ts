import { Injectable, inject } from '@angular/core';
import type { SyncCatalogSummary } from '@chesspecker/api-definitions';

import {
	CatalogCursorRepository,
	CatalogCursorState,
} from '@app/repository/catalog-cursor.repository';
import { PuzzleCatalogRepository } from '@app/repository/puzzle-catalog.repository';
import { PuzzleRepository } from '@app/repository/puzzle.repository';
import { PuzzleCacheUseCase } from '@app/use-case/puzzle-cache.use-case';

const PAGE_SIZE = 500;

/** How many exercises the replica holds and how many there are: what the splash counts. */
export type CatalogProgress = (done: number, total: number) => void;

/**
 * The catalogue replicated here. It belongs to nobody — no `pendingSince`, no conflicts, no
 * "local wins" — so it is a paged sweep the cycle fires rather than another of its tables.
 */
@Injectable({
	providedIn: 'root',
})
export class PuzzleCatalogReplicaUseCase {
	private readonly catalog = inject(PuzzleCatalogRepository);
	private readonly cursors = inject(CatalogCursorRepository);
	private readonly puzzles = inject(PuzzleRepository);
	private readonly cache = inject(PuzzleCacheUseCase);

	private sweeping: Promise<void> | null = null;

	/**
	 * `summary` is what the server says it holds. Without a session there is none, so the
	 * decision falls back to the local total, which cannot see a re-import.
	 */
	async run(summary?: SyncCatalogSummary, progress?: CatalogProgress): Promise<void> {
		this.sweeping ??= this.sweep(summary, progress)
			.catch(() => undefined)
			.finally(() => {
				this.sweeping = null;
			});

		return this.sweeping;
	}

	/**
	 * Whether the sweep has nothing to do. A current catalogue is not a download, and only a
	 * download justifies making boot wait.
	 */
	async isSynced(summary?: SyncCatalogSummary): Promise<boolean> {
		return this.isUpToDate(await this.cursors.findState(), summary);
	}

	private async sweep(
		summary: SyncCatalogSummary | undefined,
		progress: CatalogProgress | undefined,
	): Promise<void> {
		const state = await this.cursors.findState();

		if (await this.isUpToDate(state, summary)) {
			return;
		}

		let cursor = this.resumeFrom(state);
		let done = await this.puzzles.countCatalog();
		let pending = true;

		progress?.(done, summary?.total ?? state?.total ?? 0);

		while (pending) {
			const page = await this.catalog.getPage(PAGE_SIZE, cursor);

			await this.cache.save(page.items);

			const next = page.nextCursor === cursor ? null : page.nextCursor;

			done += page.items.length;
			progress?.(done, summary?.total ?? page.total);

			await this.cursors.saveState({
				cursor: next,
				total: page.total,
				// The version is the one from before the sweep began: keeping the old one is what
				// lets the next pass notice a catalogue that changed halfway through.
				version: summary?.version ?? state?.version ?? null,
				completedAt: null === next ? new Date() : null,
			});

			cursor = next;
			pending = null !== next;
		}
	}

	private resumeFrom(state: CatalogCursorState | undefined): string | null {
		return null !== state?.completedAt ? null : state.cursor;
	}

	/**
	 * With a summary the version decides: re-importing the same CSV leaves the total identical,
	 * so counting alone would call the sweep done and freeze the local ratings forever.
	 */
	private async isUpToDate(
		state: CatalogCursorState | undefined,
		summary: SyncCatalogSummary | undefined,
	): Promise<boolean> {
		if (undefined === state?.completedAt || null === state.completedAt) {
			return false;
		}

		if (undefined === summary) {
			return (await this.puzzles.countCatalog()) === state.total;
		}

		return state.version === summary.version && state.total === summary.total;
	}
}

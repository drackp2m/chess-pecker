import { Injectable, inject } from '@angular/core';

import {
	CatalogCursorRepository,
	CatalogCursorState,
} from '@app/repository/catalog-cursor.repository';
import { PuzzleCatalogRepository } from '@app/repository/puzzle-catalog.repository';
import { PuzzleRepository } from '@app/repository/puzzle.repository';
import { PuzzleCacheUseCase } from '@app/use-case/puzzle-cache.use-case';

const PAGE_SIZE = 500;

@Injectable({
	providedIn: 'root',
})
export class PuzzleCatalogReplicaUseCase {
	private readonly catalog = inject(PuzzleCatalogRepository);
	private readonly cursors = inject(CatalogCursorRepository);
	private readonly puzzles = inject(PuzzleRepository);
	private readonly cache = inject(PuzzleCacheUseCase);

	private sweeping: Promise<void> | null = null;

	async run(): Promise<void> {
		this.sweeping ??= this.sweep()
			.catch(() => undefined)
			.finally(() => {
				this.sweeping = null;
			});

		return this.sweeping;
	}

	private async sweep(): Promise<void> {
		const state = await this.cursors.findState();

		if (await this.isUpToDate(state)) {
			return;
		}

		let cursor = this.resumeFrom(state);
		let pending = true;

		while (pending) {
			const page = await this.catalog.getPage(PAGE_SIZE, cursor);

			await this.cache.save(page.items);

			const next = page.nextCursor === cursor ? null : page.nextCursor;

			await this.cursors.saveState({
				cursor: next,
				total: page.total,
				completedAt: null === next ? new Date() : null,
			});

			cursor = next;
			pending = null !== next;
		}
	}

	private resumeFrom(state: CatalogCursorState | undefined): string | null {
		return null !== state?.completedAt ? null : state.cursor;
	}

	private async isUpToDate(state: CatalogCursorState | undefined): Promise<boolean> {
		if (undefined === state?.completedAt || null === state.completedAt) {
			return false;
		}

		return (await this.puzzles.countCatalog()) === state.total;
	}
}

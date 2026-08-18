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

/** Cuántos ejercicios lleva la réplica y cuántos hay. Es lo que el splash cuenta. */
export type CatalogProgress = (done: number, total: number) => void;

/**
 * El catálogo replicado aquí. No es de nadie —no tiene `pendingSince`, ni conflictos, ni
 * la regla de «local manda» que sostiene la bajada del entrenamiento—, así que no es una
 * tabla más del ciclo: es una barrida por páginas que el ciclo dispara con el resumen en
 * la mano.
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
	 * `summary` es lo que dice el servidor que tiene. Sin él —sin sesión, que es cuando
	 * `GET /sync` no se puede pedir— se decide como se decidía antes: con el total contado
	 * aquí, que no ve una reimportación.
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
	 * Si la barrida no tiene nada que hacer. El ciclo lo pregunta antes de empezarla: un
	 * catálogo al día no es una descarga, y sólo una descarga justifica hacer esperar al
	 * arranque.
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
				// La versión es la de antes de empezar: si el catálogo cambia a mitad de la
				// barrida, quedarse con la vieja es lo que hace que la pasada siguiente lo vea.
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
	 * Con resumen, la versión decide. **Esto arregla un fallo de hoy**: la importación es
	 * un upsert que refresca rating y popularidad, así que reimportar el mismo CSV deja el
	 * total idéntico, la barrida se da por cerrada y los ratings de aquí se quedan viejos
	 * para siempre. La marca es lo único que lo ve.
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

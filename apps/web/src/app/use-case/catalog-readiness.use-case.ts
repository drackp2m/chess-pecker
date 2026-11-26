import { Injectable, inject } from '@angular/core';

import { I18n, i18nRef } from '@app/i18n';
import { CatalogCursorRepository } from '@app/repository/catalog-cursor.repository';
import { PuzzleRepository } from '@app/repository/puzzle.repository';
import { LocalFailureError } from '@app/util/local-failure-error';

@Injectable({
	providedIn: 'root',
})
export class CatalogReadinessUseCase {
	private readonly cursors = inject(CatalogCursorRepository);
	private readonly puzzles = inject(PuzzleRepository);

	async assertDownloaded(): Promise<void> {
		if (!(await this.isDownloaded())) {
			throw new LocalFailureError(
				i18nRef(I18n.common.CATALOG_NOT_READY),
				'The puzzle catalogue is not fully downloaded on this device',
			);
		}
	}

	private async isDownloaded(): Promise<boolean> {
		const state = await this.cursors.findState();

		if (undefined === state || 0 === state.total) {
			return false;
		}

		return null !== state.completedAt || state.total <= (await this.puzzles.countCatalog());
	}
}

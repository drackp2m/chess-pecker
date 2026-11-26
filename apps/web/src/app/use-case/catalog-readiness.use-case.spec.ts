import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18n } from '@app/i18n';
import {
	CatalogCursorRepository,
	CatalogCursorState,
} from '@app/repository/catalog-cursor.repository';
import { PuzzleRepository } from '@app/repository/puzzle.repository';
import { CatalogReadinessUseCase } from '@app/use-case/catalog-readiness.use-case';
import { LocalFailureError } from '@app/util/local-failure-error';

const TOTAL = 22_000;

function swept(over: Partial<CatalogCursorState> = {}): CatalogCursorState {
	return {
		cursor: null,
		total: TOTAL,
		version: 'v1',
		completedAt: new Date('2026-08-18T09:00:00.000Z'),
		...over,
	};
}

function configure(state: CatalogCursorState | undefined, localCount = 0) {
	const cursors = { findState: vi.fn(() => Promise.resolve(state)) };
	const puzzles = { countCatalog: vi.fn(() => Promise.resolve(localCount)) };

	TestBed.configureTestingModule({
		providers: [
			{ provide: CatalogCursorRepository, useValue: cursors },
			{ provide: PuzzleRepository, useValue: puzzles },
		],
	});

	return TestBed.inject(CatalogReadinessUseCase);
}

describe('CatalogReadinessUseCase.assertDownloaded', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('lets a training start once a sweep has finished', async () => {
		await expect(configure(swept()).assertDownloaded()).resolves.toBeUndefined();
	});

	it('refuses while nothing has ever been swept', async () => {
		await expect(configure(undefined).assertDownloaded()).rejects.toMatchObject({
			ref: { key: I18n.common.CATALOG_NOT_READY },
		});
	});

	it('refuses while the first sweep is still halfway', async () => {
		const readiness = configure(swept({ cursor: 'page-3', completedAt: null }), 1500);

		await expect(readiness.assertDownloaded()).rejects.toBeInstanceOf(LocalFailureError);
	});

	it('does not block a new sweep over a catalogue that is already all here', async () => {
		const readiness = configure(swept({ cursor: 'page-3', completedAt: null }), TOTAL);

		await expect(readiness.assertDownloaded()).resolves.toBeUndefined();
	});
});

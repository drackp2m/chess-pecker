import { TestBed } from '@angular/core/testing';
import type { PuzzleCatalogPage, SyncCatalogSummary } from '@chesspecker/api-definitions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	CatalogCursorRepository,
	CatalogCursorState,
} from '@app/repository/catalog-cursor.repository';
import { PuzzleCatalogRepository } from '@app/repository/puzzle-catalog.repository';
import { PuzzleRepository } from '@app/repository/puzzle.repository';
import { PuzzleCacheUseCase } from '@app/use-case/puzzle-cache.use-case';
import { PuzzleCatalogReplicaUseCase } from '@app/use-case/puzzle-catalog-replica.use-case';
import { withExclusiveLock } from '@app/util/exclusive-lock';

const CATALOG_LOCK_NAME = 'chesspecker-catalog';

const SWEPT = new Date('2026-08-18T09:00:00.000Z');

const CURRENT: SyncCatalogSummary = { version: 'v1', total: 2 };

interface Options {
	readonly state?: CatalogCursorState;
	readonly localCount?: number;
}

function swept(over: Partial<CatalogCursorState> = {}): CatalogCursorState {
	return {
		cursor: null,
		total: CURRENT.total,
		version: CURRENT.version,
		completedAt: SWEPT,
		...over,
	};
}

function lastPage(): PuzzleCatalogPage {
	return { items: [], nextCursor: null, total: CURRENT.total };
}

function holdLock(name: string): () => void {
	let release: () => void = () => undefined;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});

	void withExclusiveLock(name, () => held);

	return () => {
		release();
	};
}

function nextTask(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, 0);
	});
}

function configure(options: Options = {}) {
	const catalog = {
		getPage: vi.fn((_limit: number, _after: string | null) => Promise.resolve(lastPage())),
	};
	const cursors = {
		findState: vi.fn(() => Promise.resolve(options.state)),
		saveState: vi.fn((_state: CatalogCursorState) => Promise.resolve()),
	};
	const puzzles = { countCatalog: vi.fn(() => Promise.resolve(options.localCount ?? 0)) };
	const cache = { save: vi.fn(() => Promise.resolve()) };

	TestBed.configureTestingModule({
		providers: [
			{ provide: PuzzleCatalogRepository, useValue: catalog },
			{ provide: CatalogCursorRepository, useValue: cursors },
			{ provide: PuzzleRepository, useValue: puzzles },
			{ provide: PuzzleCacheUseCase, useValue: cache },
		],
	});

	return { catalog, cursors, replica: TestBed.inject(PuzzleCatalogReplicaUseCase) };
}

describe('PuzzleCatalogReplicaUseCase.run', () => {
	let releaseLock: () => void = () => undefined;

	afterEach(() => {
		releaseLock();
		TestBed.resetTestingModule();
	});

	it('does nothing when version and total match', async () => {
		const { catalog, replica } = configure({ state: swept() });

		await replica.run(CURRENT);

		expect(catalog.getPage).not.toHaveBeenCalled();
	});

	it('sweeps again when the version moved though the total did not', async () => {
		const { catalog, replica } = configure({ state: swept() });

		await replica.run({ ...CURRENT, version: 'v2' });

		expect(catalog.getPage).toHaveBeenCalledTimes(1);
	});

	it('resumes from the last page it served', async () => {
		const { catalog, replica } = configure({
			state: swept({ cursor: 'page-3', completedAt: null }),
		});

		await replica.run(CURRENT);

		expect(catalog.getPage).toHaveBeenCalledWith(expect.any(Number), 'page-3');
	});

	it('decides by the local count without a session', async () => {
		const { catalog, replica } = configure({ state: swept(), localCount: CURRENT.total });

		await replica.run();

		expect(catalog.getPage).not.toHaveBeenCalled();
	});

	it('sweeps under its own lock', async () => {
		const { catalog, replica } = configure({ state: swept({ version: 'v0' }) });

		releaseLock = holdLock(CATALOG_LOCK_NAME);

		const sweeping = replica.run(CURRENT);

		await nextTask();

		expect(catalog.getPage).not.toHaveBeenCalled();

		releaseLock();
		await sweeping;

		expect(catalog.getPage).toHaveBeenCalledTimes(1);
	});
});

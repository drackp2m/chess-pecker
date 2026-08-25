import { TestBed } from '@angular/core/testing';
import type { SyncEntity, SyncPartialCycle, SyncSummary } from '@chesspecker/api-definitions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { SYNC_SCHEMA_VERSION } from '@app/definition/sync-schema.constant';
import { SyncCursorRepository } from '@app/repository/sync-cursor.repository';
import { TrainingRepository } from '@app/repository/training.repository';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { PullTreeUseCase } from '@app/use-case/sync/pull-tree.use-case';
import { SyncPullUseCase } from '@app/use-case/sync/sync-pull.use-case';
import { SyncStatus } from '@app/use-case/sync/sync-summary.use-case';
import { TrainingRestoreUseCase } from '@app/use-case/training-restore.use-case';

const NOTHING = { cursor: null, count: 0 };

const PARTIAL: SyncPartialCycle = {
	uuid: 'cycle-2',
	trainingUuid: 'training-1',
	index: 2,
	itemCount: 1000,
	storedItems: 399,
};

function summary(partialCycles: readonly SyncPartialCycle[]): SyncSummary {
	return {
		serverTime: '2026-08-25T09:00:00.000Z',
		schemaVersion: SYNC_SCHEMA_VERSION,
		entities: Object.fromEntries(
			SYNC_ENTITIES.map((entity) => [entity, NOTHING]),
		) as SyncSummary['entities'],
		catalog: { version: '2026-08-01T09:00:00.000Z', total: 10 },
		partialCycles,
	};
}

function status(
	behind: readonly SyncEntity[],
	partialCycles: readonly SyncPartialCycle[],
): SyncStatus {
	return { summary: summary(partialCycles), canPush: true, behind, treeCursor: undefined };
}

function configure(options: { readonly declareFails?: boolean } = {}) {
	const cycles = {
		declarePartial: vi.fn(() =>
			true === options.declareFails
				? Promise.reject(new Error('database closed'))
				: Promise.resolve(1),
		),
	};
	const trainings = { list: vi.fn(() => Promise.resolve([{ uuid: 'training-1' }])) };
	const trees = { execute: vi.fn(() => Promise.resolve(7)) };
	const restore = { execute: vi.fn(() => Promise.resolve(true)) };
	const cursors = { saveCursor: vi.fn(() => Promise.resolve()) };

	TestBed.configureTestingModule({
		providers: [
			{ provide: LocalCycleUseCase, useValue: cycles },
			{ provide: TrainingRepository, useValue: trainings },
			{ provide: PullTreeUseCase, useValue: trees },
			{ provide: TrainingRestoreUseCase, useValue: restore },
			{ provide: SyncCursorRepository, useValue: cursors },
		],
	});

	return { cycles, trainings, trees, restore, cursors, pull: TestBed.inject(SyncPullUseCase) };
}

describe('SyncPullUseCase', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('marks the cycles the server reported as partial, even with nothing to download', async () => {
		const { pull, cycles, trainings } = configure();

		await expect(pull.execute(status([], [PARTIAL]))).resolves.toMatchObject({ rows: 0 });
		expect(cycles.declarePartial).toHaveBeenCalledWith([PARTIAL]);
		expect(trainings.list).not.toHaveBeenCalled();
	});

	it('marks them before pulling anything, so a cut download still leaves the warning', async () => {
		const order: string[] = [];
		const { pull, cycles, trees } = configure();

		cycles.declarePartial.mockImplementationOnce(() => {
			order.push('declare');

			return Promise.resolve(1);
		});
		trees.execute.mockImplementationOnce(() => {
			order.push('tree');

			return Promise.resolve(7);
		});

		await pull.execute(status(['cycle'], [PARTIAL]));

		expect(order).toEqual(['declare', 'tree']);
	});

	it('goes on with the download when the marking could not be written', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { pull, trees } = configure({ declareFails: true });

		await expect(pull.execute(status(['cycle'], [PARTIAL]))).resolves.toMatchObject({ rows: 7 });
		expect(trees.execute).toHaveBeenCalledTimes(1);
		expect(logged).toHaveBeenCalled();

		logged.mockRestore();
	});
});

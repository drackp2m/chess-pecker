import { TestBed } from '@angular/core/testing';
import type { CycleProgress, TrainingProgress, TrainingStatus } from '@chesspecker/api-definitions';
import { patchState } from '@ngrx/signals';
import { afterEach, describe, expect, it } from 'vitest';

import { TrainingRow } from '@app/repository/definition/training-schema.interface';
import { SyncStore } from '@app/store/sync.store';
import { TrainingStore } from '@app/store/training.store';
import { TrainingEngineUseCase } from '@app/use-case/training-engine.use-case';

const NOW = new Date('2026-08-25T09:00:00.000Z');

function training(status: TrainingStatus): TrainingRow {
	return { uuid: 'training-1', status, createdAt: NOW, updatedAt: NOW };
}

function cycle(status: CycleProgress['status']): CycleProgress {
	return {
		uuid: `cycle-${status}`,
		index: 1,
		status,
		startedAt: NOW.toISOString(),
		attempted: 0,
		total: 10,
		solved: 0,
		accuracy: 0,
		totalDurationMs: 0,
		averageDurationMs: 0,
		targetDurationMs: null,
		lastAttemptAt: null,
	};
}

function progress(cycles: readonly CycleProgress[]): TrainingProgress {
	return {
		calibration: { rating: 1500, averageDurationMs: null, rounds: [] },
		setSize: 10,
		goal: null,
		estimatedFirstCycleDays: null,
		cycles,
		suggestFinish: false,
	};
}

function configure(active: TrainingRow | null, cycles: readonly CycleProgress[]): TrainingStore {
	TestBed.configureTestingModule({
		providers: [
			{ provide: TrainingEngineUseCase, useValue: {} },
			{
				provide: SyncStore,
				useValue: { isSyncing: () => false, pending: () => 0, lastSyncedAt: () => null },
			},
		],
	});

	const store = TestBed.inject(TrainingStore);

	patchState(store, { active, progress: null === active ? null : progress(cycles) });

	return store;
}

describe('TrainingStore.canSolve', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('opens the board while the training is still being calibrated', () => {
		expect(configure(training('calibrating'), []).canSolve()).toBe(true);
	});

	it('opens the board once a cycle is running', () => {
		expect(configure(training('running'), [cycle('running')]).canSolve()).toBe(true);
	});

	it('keeps the board shut while the set is still being planned', () => {
		expect(configure(training('planning'), []).canSolve()).toBe(false);
	});

	it('keeps the board shut when every cycle is already closed', () => {
		expect(configure(training('running'), [cycle('finished')]).canSolve()).toBe(false);
	});

	it('keeps the board shut with no training at all', () => {
		expect(configure(null, []).canSolve()).toBe(false);
	});
});

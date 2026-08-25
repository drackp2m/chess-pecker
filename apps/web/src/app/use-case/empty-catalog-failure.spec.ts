import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18n, i18nRef } from '@app/i18n';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { LocalCalibrationUseCase } from '@app/use-case/local-calibration.use-case';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { LocalTrainingUseCase } from '@app/use-case/local-training.use-case';
import { HttpError } from '@app/util/http-error';
import { LocalFailureError } from '@app/util/local-failure-error';

const TRAINING = 'training-1';

const FALLBACK = i18nRef(I18n.training.START_CYCLE_ERROR);

const CATALOG_EMPTY = { key: I18n.common.CATALOG_EMPTY };

function emptyRepository() {
	return {
		findAllByIndex: vi.fn(() => Promise.resolve([])),
		sampleByRating: vi.fn(() => Promise.resolve([])),
		insert: vi.fn((_store: string, row: unknown) => Promise.resolve(row)),
		batchInsert: vi.fn(() => Promise.resolve()),
	};
}

function trainingsAt(status: 'calibrating' | 'planning') {
	return {
		find: vi.fn(() => Promise.resolve({ uuid: TRAINING, status })),
		currentGoal: vi.fn(() => Promise.resolve(undefined)),
		updateStatus: vi.fn(() => Promise.resolve()),
	};
}

function calibratingTraining(): LocalCalibrationUseCase {
	TestBed.configureTestingModule({
		providers: [
			{ provide: TrainingLocalRepository, useValue: emptyRepository() },
			{ provide: LocalTrainingUseCase, useValue: trainingsAt('calibrating') },
		],
	});

	return TestBed.inject(LocalCalibrationUseCase);
}

function calibratedTraining(): LocalCycleUseCase {
	TestBed.configureTestingModule({
		providers: [
			{ provide: TrainingLocalRepository, useValue: emptyRepository() },
			{ provide: LocalTrainingUseCase, useValue: trainingsAt('planning') },
			{
				provide: LocalCalibrationUseCase,
				useValue: {
					findAcceptedRound: vi.fn(() => Promise.resolve({ uuid: 'round-1', rating: 1500 })),
				},
			},
		],
	});

	return TestBed.inject(LocalCycleUseCase);
}

async function refusalOf(run: () => Promise<unknown>) {
	try {
		await run();
	} catch (error) {
		expect(error).toBeInstanceOf(LocalFailureError);

		return HttpError.toRef(error, FALLBACK);
	}

	throw new Error('It resolved instead of refusing');
}

describe('an empty local catalogue', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('stops a calibration round with the reason the screen can print', async () => {
		const calibration = calibratingTraining();

		expect(await refusalOf(() => calibration.createRound(TRAINING))).toEqual(CATALOG_EMPTY);
	});

	it('stops the set selection with the same reason', async () => {
		const cycles = calibratedTraining();

		expect(await refusalOf(() => cycles.selectSet(TRAINING, 10))).toEqual(CATALOG_EMPTY);
	});

	it('still falls back for anything that is not a local failure', () => {
		expect(HttpError.toRef(new Error('boom'), FALLBACK)).toEqual(FALLBACK);
	});
});

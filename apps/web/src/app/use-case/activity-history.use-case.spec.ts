import { TestBed } from '@angular/core/testing';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActivityRepository } from '@app/repository/activity.repository';
import { TrainingRepository } from '@app/repository/training.repository';
import { SessionStore } from '@app/store/session.store';
import { ActivityHistoryUseCase } from '@app/use-case/activity-history.use-case';

const TODAY = new Date('2026-08-25T00:00:00.000Z');

const CURSOR = '2026-08-25T00:00:00.000Z';

function day(date: string, done: number): TrainingActivityDay {
	return {
		date,
		done,
		firstTry: done,
		afterMiss: 0,
		shown: 0,
		foundClean: done,
		foundHinted: 0,
		foundMissed: 0,
		foundMissedHinted: 0,
		revealed: 0,
		revealedHinted: 0,
		mistakes: 0,
		hints: 0,
		durationMs: 1000 * done,
	};
}

interface Options {
	readonly isAuthenticated?: boolean;
	readonly stored?: readonly TrainingActivityDay[];
	readonly cursor?: string | null;
	readonly getActivity?: () => Promise<never>;
}

function configure(options: Options = {}) {
	const stored = options.stored ?? [];
	const activityRepository = {
		findRange: vi.fn(() => Promise.resolve([...stored])),
		countRange: vi.fn(() => Promise.resolve(stored.length)),
		firstDate: vi.fn(() => Promise.resolve(stored.at(0)?.date)),
		findCursor: vi.fn(() => Promise.resolve(options.cursor ?? null)),
		saveAll: vi.fn(() => Promise.resolve()),
		saveCursor: vi.fn(() => Promise.resolve()),
	};
	const trainingRepository = {
		getActivity:
			options.getActivity ?? vi.fn(() => Promise.resolve({ days: [...stored], cursor: CURSOR })),
	};

	TestBed.configureTestingModule({
		providers: [
			{ provide: ActivityRepository, useValue: activityRepository },
			{ provide: TrainingRepository, useValue: trainingRepository },
			{
				provide: SessionStore,
				useValue: { isAuthenticated: () => options.isAuthenticated ?? true },
			},
		],
	});

	return {
		activityRepository,
		trainingRepository,
		history: TestBed.inject(ActivityHistoryUseCase),
	};
}

describe('ActivityHistoryUseCase.read', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('asks the API for nothing at all without a session', async () => {
		const { history, trainingRepository } = configure({ isAuthenticated: false });

		await history.read(7, TODAY);

		expect(trainingRepository.getActivity).not.toHaveBeenCalled();
	});

	it('reads an anonymous device as complete rather than out of date', async () => {
		const { history } = configure({ isAuthenticated: false });

		const activity = await history.read(7, TODAY);

		expect(activity.isStale).toBe(false);
		expect(activity.days).toHaveLength(7);
	});

	it('serves what a device trained offline holds, session or not', async () => {
		const { history } = configure({ isAuthenticated: false, stored: [day('2026-08-25', 4)] });

		const activity = await history.read(7, TODAY);

		expect(activity.days.at(-1)).toEqual(day('2026-08-25', 4));
		expect(activity.days.at(0)?.done).toBe(0);
	});

	it('pulls the whole range when the device is missing days', async () => {
		const { history, trainingRepository, activityRepository } = configure();

		const activity = await history.read(7, TODAY);

		expect(trainingRepository.getActivity).toHaveBeenCalledWith(7);
		expect(activityRepository.saveCursor).toHaveBeenCalledWith(CURSOR);
		expect(activity.isStale).toBe(false);
	});

	it('asks only for what changed once the range is already stored', async () => {
		const stored = Array.from({ length: 7 }, (_unused, index) =>
			day(`2026-08-${(19 + index).toString()}`, 1),
		);
		const { history, trainingRepository } = configure({ stored, cursor: CURSOR });

		await history.read(7, TODAY);

		expect(trainingRepository.getActivity).toHaveBeenCalledWith(7, CURSOR);
	});

	it('marks the answer stale when the call it needed failed', async () => {
		const { history } = configure({
			getActivity: vi.fn(() => Promise.reject(new Error('offline'))),
		});

		expect((await history.read(7, TODAY)).isStale).toBe(true);
	});
});

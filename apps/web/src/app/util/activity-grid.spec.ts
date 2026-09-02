import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { describe, expect, it } from 'vitest';

import { emptyActivityDay } from '@app/util/activity-day';
import { activityDaySeries, filterActivityDays } from '@app/util/activity-grid';

function day(date: string, done: number): TrainingActivityDay {
	return { ...emptyActivityDay(date), done };
}

describe('activityDaySeries', () => {
	it('cuts the window on the civil day in the requested timezone', () => {
		const today = new Date('2026-09-02T00:30:00.000Z');
		const days = activityDaySeries([day('2026-09-01', 2)], 2, 'America/Los_Angeles', today);

		expect(days.map((item) => item.date)).toEqual(['2026-08-31', '2026-09-01']);
		expect(days[0]?.done).toBe(0);
		expect(days[1]?.done).toBe(2);
	});

	it('keeps the window on UTC when the zone is UTC', () => {
		const today = new Date('2026-09-02T00:30:00.000Z');
		const days = activityDaySeries([], 2, 'UTC', today);

		expect(days.map((item) => item.date)).toEqual(['2026-09-01', '2026-09-02']);
	});

	it('windows ahead on an extreme-east zone without daylight saving', () => {
		const today = new Date('2026-09-02T10:00:00.000Z');
		const days = activityDaySeries([], 2, 'Pacific/Kiritimati', today);

		expect(days.map((item) => item.date)).toEqual(['2026-09-02', '2026-09-03']);
	});

	it('fills missing days with zeros', () => {
		const today = new Date('2026-09-03T12:00:00.000Z');
		const days = activityDaySeries([day('2026-09-01', 5), day('2026-09-03', 3)], 3, 'UTC', today);

		expect(days.map((item) => item.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
		expect(days.map((item) => item.done)).toEqual([5, 0, 3]);
		expect(days.map((item) => item.firstTry)).toEqual([0, 0, 0]);
	});

	it('drops days outside the window', () => {
		const today = new Date('2026-09-03T12:00:00.000Z');
		const days = activityDaySeries(
			[day('2026-08-31', 1), day('2026-09-01', 2), day('2026-09-03', 4)],
			2,
			'UTC',
			today,
		);

		expect(days.map((item) => item.date)).toEqual(['2026-09-02', '2026-09-03']);
		expect(days.map((item) => item.done)).toEqual([0, 4]);
	});

	it('returns a single day when the window is one day', () => {
		const today = new Date('2026-09-03T12:00:00.000Z');
		const days = activityDaySeries([day('2026-09-03', 7)], 1, 'UTC', today);

		expect(days.map((item) => item.date)).toEqual(['2026-09-03']);
		expect(days[0]?.done).toBe(7);
	});

	it('returns no days when the window is empty', () => {
		const today = new Date('2026-09-03T12:00:00.000Z');
		const days = activityDaySeries([day('2026-09-03', 7)], 0, 'UTC', today);

		expect(days).toEqual([]);
	});

	it('spans a large window filling every gap', () => {
		const today = new Date('2026-09-03T12:00:00.000Z');
		const days = activityDaySeries([day('2026-08-01', 1)], 60, 'UTC', today);

		expect(days).toHaveLength(60);
		expect(days[0]?.date).toBe('2026-07-06');
		expect(days[59]?.date).toBe('2026-09-03');
		expect(days[0]?.done).toBe(0);
		expect(days[26]?.done).toBe(1);
	});
});

describe('filterActivityDays', () => {
	it('keeps only input days within the window', () => {
		const today = new Date('2026-09-05T12:00:00.000Z');
		const days = filterActivityDays(
			[day('2026-09-01', 1), day('2026-09-03', 2), day('2026-09-05', 3)],
			3,
			today,
		);

		expect(days.map((item) => item.date)).toEqual(['2026-09-03', '2026-09-05']);
		expect(days.map((item) => item.done)).toEqual([2, 3]);
	});

	it('returns empty when all days are before the window', () => {
		const today = new Date('2026-09-05T12:00:00.000Z');
		const days = filterActivityDays([day('2026-09-01', 1)], 2, today);

		expect(days).toEqual([]);
	});

	it('keeps only today when the window is one day', () => {
		const today = new Date('2026-09-05T12:00:00.000Z');
		const days = filterActivityDays([day('2026-09-04', 1), day('2026-09-05', 2)], 1, today);

		expect(days.map((item) => item.date)).toEqual(['2026-09-05']);
		expect(days[0]?.done).toBe(2);
	});

	it('returns empty when the window is zero days', () => {
		const today = new Date('2026-09-05T12:00:00.000Z');
		const days = filterActivityDays([day('2026-09-05', 2)], 0, today);

		expect(days).toEqual([]);
	});

	it('keeps everything within a large window', () => {
		const today = new Date('2026-09-05T12:00:00.000Z');
		const days = filterActivityDays(
			[day('2026-07-01', 1), day('2026-09-01', 2), day('2026-09-05', 3)],
			100,
			today,
		);

		expect(days.map((item) => item.date)).toEqual(['2026-07-01', '2026-09-01', '2026-09-05']);
	});
});

import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { describe, expect, it } from 'vitest';

import { emptyActivityDay } from '@app/util/activity-day';
import { activityDaySeries, cyclePaceSeries, filterActivityDays } from '@app/util/activity-grid';

function day(
	date: string,
	done = 0,
	values: Partial<Omit<TrainingActivityDay, 'date'>> = {},
): TrainingActivityDay {
	return { ...emptyActivityDay(date), done, ...values };
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

	it('spans a window crossing a leap February', () => {
		const today = new Date('2028-03-01T12:00:00.000Z');
		const days = activityDaySeries(
			[day('2028-02-28', 1), day('2028-02-29', 2), day('2028-03-01', 3)],
			3,
			'UTC',
			today,
		);

		expect(days.map((item) => item.date)).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
		expect(days.map((item) => item.done)).toEqual([1, 2, 3]);
	});

	it('spans a window crossing a non-leap February', () => {
		const today = new Date('2026-03-01T12:00:00.000Z');
		const days = activityDaySeries([day('2026-02-28', 2), day('2026-03-01', 3)], 3, 'UTC', today);

		expect(days.map((item) => item.date)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
		expect(days.map((item) => item.done)).toEqual([0, 2, 3]);
	});

	it('spans a window crossing the year boundary', () => {
		const today = new Date('2027-01-02T12:00:00.000Z');
		const days = activityDaySeries([day('2026-12-31', 5)], 4, 'UTC', today);

		expect(days.map((item) => item.date)).toEqual([
			'2026-12-30',
			'2026-12-31',
			'2027-01-01',
			'2027-01-02',
		]);
		expect(days.map((item) => item.done)).toEqual([0, 5, 0, 0]);
	});

	it('carries every counter through and zeroes full gap days across months', () => {
		const today = new Date('2026-02-05T12:00:00.000Z');
		const heavy = day('2026-01-29', 4, {
			firstTry: 2,
			afterMiss: 1,
			shown: 1,
			mistakes: 3,
			hints: 2,
			durationMs: 60_000,
		});
		const light = day('2026-02-02', 3, { firstTry: 1, revealed: 2 });
		const days = activityDaySeries([heavy, light], 8, 'UTC', today);

		expect(days.map((item) => item.date)).toEqual([
			'2026-01-29',
			'2026-01-30',
			'2026-01-31',
			'2026-02-01',
			'2026-02-02',
			'2026-02-03',
			'2026-02-04',
			'2026-02-05',
		]);
		expect(days[0]).toEqual(heavy);
		expect(days[4]).toEqual(light);
		expect(days[4]?.mistakes).toBe(0);
		expect(days[1]).toEqual(emptyActivityDay('2026-01-30'));
		expect(days[5]).toEqual(emptyActivityDay('2026-02-03'));
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

describe('cyclePaceSeries', () => {
	it('walks the cycle days accumulating delta and drift', () => {
		const startedAt = '2026-09-01T10:00:00.000Z';
		const today = new Date('2026-09-04T12:00:00.000Z');
		const series = cyclePaceSeries(
			[day('2026-09-01', 5), day('2026-09-03', 3)],
			startedAt,
			3,
			today,
		);

		expect(series.map((item) => item.date)).toEqual([
			'2026-09-01',
			'2026-09-02',
			'2026-09-03',
			'2026-09-04',
		]);
		expect(series.map((item) => item.done)).toEqual([5, 0, 3, 0]);
		expect(series.map((item) => item.expected)).toEqual([3, 3, 3, 3]);
		expect(series.map((item) => item.delta)).toEqual([2, -3, 0, -3]);
		expect(series.map((item) => item.drift)).toEqual([2, -1, -1, -4]);
	});

	it('returns a single day when the cycle started today', () => {
		const today = new Date('2026-09-04T12:00:00.000Z');
		const series = cyclePaceSeries([day('2026-09-04', 1)], '2026-09-04T00:30:00.000Z', 2, today);

		expect(series).toHaveLength(1);
		expect(series[0]).toEqual({ date: '2026-09-04', done: 1, expected: 2, delta: -1, drift: -1 });
	});

	it('returns nothing when the cycle starts in the future', () => {
		const today = new Date('2026-09-04T12:00:00.000Z');
		const series = cyclePaceSeries([], '2026-09-05T00:00:00.000Z', 3, today);

		expect(series).toEqual([]);
	});

	it('walks the cycle across the year boundary', () => {
		const startedAt = '2026-12-30T23:00:00.000Z';
		const today = new Date('2027-01-02T06:00:00.000Z');
		const series = cyclePaceSeries([day('2027-01-01', 4)], startedAt, 4, today);

		expect(series.map((item) => item.date)).toEqual([
			'2026-12-30',
			'2026-12-31',
			'2027-01-01',
			'2027-01-02',
		]);
		expect(series.map((item) => item.done)).toEqual([0, 0, 4, 0]);
		expect(series.map((item) => item.delta)).toEqual([-4, -4, 0, -4]);
		expect(series.map((item) => item.drift)).toEqual([-4, -8, -8, -12]);
	});
});

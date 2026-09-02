import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { describe, expect, it } from 'vitest';

import { emptyActivityDay } from '@app/util/activity-day';
import { activityDaySeries } from '@app/util/activity-grid';

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
});

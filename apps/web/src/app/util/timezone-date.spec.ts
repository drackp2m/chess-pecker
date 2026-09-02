import { describe, expect, it } from 'vitest';

import {
	addLabelDays,
	diffLabelDays,
	labelToUtcMidnight,
	zoneDayLabel,
} from '@app/util/timezone-date';

describe('zoneDayLabel', () => {
	it('uses the requested timezone when an instant crosses midnight', () => {
		const instant = new Date('2026-09-02T00:30:00.000Z');

		expect(zoneDayLabel(instant, 'UTC')).toBe('2026-09-02');
		expect(zoneDayLabel(instant, 'America/Los_Angeles')).toBe('2026-09-01');
	});

	it('handles daylight-saving transitions as civil dates', () => {
		const instant = new Date('2026-03-29T00:30:00.000Z');

		expect(zoneDayLabel(instant, 'Europe/Madrid')).toBe('2026-03-29');
	});
});

describe('labelToUtcMidnight', () => {
	it('converts a civil date to UTC midnight', () => {
		expect(labelToUtcMidnight('2026-09-02')).toEqual(new Date('2026-09-02T00:00:00.000Z'));
	});
});

describe('addLabelDays', () => {
	it('moves across month and year boundaries', () => {
		expect(addLabelDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addLabelDays('2027-01-01', -1)).toBe('2026-12-31');
	});

	it('handles leap days', () => {
		expect(addLabelDays('2028-02-28', 1)).toBe('2028-02-29');
		expect(addLabelDays('2028-02-29', 1)).toBe('2028-03-01');
	});
});

describe('diffLabelDays', () => {
	it('returns the signed number of civil days between labels', () => {
		expect(diffLabelDays('2026-09-01', '2026-09-04')).toBe(3);
		expect(diffLabelDays('2026-09-04', '2026-09-01')).toBe(-3);
	});
});

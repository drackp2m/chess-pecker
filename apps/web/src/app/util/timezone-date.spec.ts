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

	it('flips the local day at different midnights in winter and summer', () => {
		const january = new Date('2026-01-15T07:59:00.000Z');
		const july = new Date('2026-07-15T06:59:00.000Z');

		expect(zoneDayLabel(january, 'America/Los_Angeles')).toBe('2026-01-14');
		expect(zoneDayLabel(new Date(january.getTime() + 60_000), 'America/Los_Angeles')).toBe(
			'2026-01-15',
		);
		expect(zoneDayLabel(july, 'America/Los_Angeles')).toBe('2026-07-14');
		expect(zoneDayLabel(new Date(july.getTime() + 60_000), 'America/Los_Angeles')).toBe(
			'2026-07-15',
		);
	});

	it('labels the next day on an extreme-east zone without daylight saving', () => {
		const before = new Date('2026-09-02T09:59:00.000Z');

		expect(zoneDayLabel(before, 'Pacific/Kiritimati')).toBe('2026-09-02');
		expect(zoneDayLabel(new Date(before.getTime() + 60_000), 'Pacific/Kiritimati')).toBe(
			'2026-09-03',
		);
		expect(zoneDayLabel(new Date('2026-09-02T23:30:00.000Z'), 'Pacific/Kiritimati')).toBe(
			'2026-09-03',
		);
	});

	it('labels the previous day on an extreme-west zone without daylight saving', () => {
		const before = new Date('2026-09-02T09:59:00.000Z');

		expect(zoneDayLabel(before, 'Pacific/Honolulu')).toBe('2026-09-01');
		expect(zoneDayLabel(new Date(before.getTime() + 60_000), 'Pacific/Honolulu')).toBe(
			'2026-09-02',
		);
	});

	it('moves the midnight flip with southern-hemisphere daylight saving', () => {
		const before = new Date('2026-01-15T10:59:00.000Z');
		const summerFlip = new Date('2026-01-15T11:00:00.000Z');

		expect(zoneDayLabel(before, 'Pacific/Auckland')).toBe('2026-01-15');
		expect(zoneDayLabel(summerFlip, 'Pacific/Auckland')).toBe('2026-01-16');

		const winterFlip = new Date('2026-06-15T12:00:00.000Z');

		expect(zoneDayLabel(new Date('2026-06-15T11:59:00.000Z'), 'Pacific/Auckland')).toBe(
			'2026-06-15',
		);
		expect(zoneDayLabel(winterFlip, 'Pacific/Auckland')).toBe('2026-06-16');
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

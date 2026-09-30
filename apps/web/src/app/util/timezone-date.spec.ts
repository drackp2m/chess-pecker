import { afterEach, describe, expect, it, vi } from 'vitest';

import { countDateTimeFormats } from '@app/testing/intl.harness';
import {
	addLabelDays,
	diffLabelDays,
	labelToUtcMidnight,
	zoneDayLabel,
} from '@app/util/timezone-date';

describe('zoneDayLabel', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

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

	it('flips the day on a quarter-hour offset', () => {
		expect(zoneDayLabel(new Date('2026-09-01T18:14:00.000Z'), 'Asia/Kathmandu')).toBe('2026-09-01');
		expect(zoneDayLabel(new Date('2026-09-01T18:15:00.000Z'), 'Asia/Kathmandu')).toBe('2026-09-02');
	});

	it('follows a half-hour daylight-saving shift', () => {
		expect(zoneDayLabel(new Date('2026-01-14T12:59:00.000Z'), 'Australia/Lord_Howe')).toBe(
			'2026-01-14',
		);
		expect(zoneDayLabel(new Date('2026-01-14T13:00:00.000Z'), 'Australia/Lord_Howe')).toBe(
			'2026-01-15',
		);
		expect(zoneDayLabel(new Date('2026-07-14T13:29:00.000Z'), 'Australia/Lord_Howe')).toBe(
			'2026-07-14',
		);
		expect(zoneDayLabel(new Date('2026-07-14T13:30:00.000Z'), 'Australia/Lord_Howe')).toBe(
			'2026-07-15',
		);
	});

	it('reads Etc/GMT offsets with their inverted sign', () => {
		const instant = new Date('2026-09-02T11:00:00.000Z');

		expect(zoneDayLabel(instant, 'Etc/GMT+12')).toBe('2026-09-01');
		expect(zoneDayLabel(instant, 'Pacific/Kiritimati')).toBe('2026-09-03');
		expect(zoneDayLabel(new Date('2026-09-02T12:00:00.000Z'), 'Etc/GMT+12')).toBe('2026-09-02');
	});

	it('rolls the year over on the local midnight', () => {
		expect(zoneDayLabel(new Date('2026-12-31T22:59:00.000Z'), 'Europe/Madrid')).toBe('2026-12-31');
		expect(zoneDayLabel(new Date('2026-12-31T23:00:00.000Z'), 'Europe/Madrid')).toBe('2027-01-01');
	});

	it('keeps a 23-hour spring-forward day and a 25-hour fall-back day whole', () => {
		expect(zoneDayLabel(new Date('2026-03-28T22:59:00.000Z'), 'Europe/Madrid')).toBe('2026-03-28');
		expect(zoneDayLabel(new Date('2026-03-28T23:00:00.000Z'), 'Europe/Madrid')).toBe('2026-03-29');
		expect(zoneDayLabel(new Date('2026-03-29T21:59:00.000Z'), 'Europe/Madrid')).toBe('2026-03-29');
		expect(zoneDayLabel(new Date('2026-03-29T22:00:00.000Z'), 'Europe/Madrid')).toBe('2026-03-30');

		expect(zoneDayLabel(new Date('2026-10-24T21:59:00.000Z'), 'Europe/Madrid')).toBe('2026-10-24');
		expect(zoneDayLabel(new Date('2026-10-24T22:00:00.000Z'), 'Europe/Madrid')).toBe('2026-10-25');
		expect(zoneDayLabel(new Date('2026-10-25T22:59:00.000Z'), 'Europe/Madrid')).toBe('2026-10-25');
		expect(zoneDayLabel(new Date('2026-10-25T23:00:00.000Z'), 'Europe/Madrid')).toBe('2026-10-26');
	});

	it('labels a leap day on each side of UTC', () => {
		expect(zoneDayLabel(new Date('2028-02-28T23:00:00.000Z'), 'Europe/Madrid')).toBe('2028-02-29');
		expect(zoneDayLabel(new Date('2028-03-01T07:59:00.000Z'), 'America/Los_Angeles')).toBe(
			'2028-02-29',
		);
		expect(zoneDayLabel(new Date('2028-03-01T08:00:00.000Z'), 'America/Los_Angeles')).toBe(
			'2028-03-01',
		);
	});

	it('builds one formatter per zone however many labels it produces', () => {
		const built = countDateTimeFormats();
		const labels = new Set<string>();

		for (let minute = 0; 2000 > minute; minute++) {
			const instant = new Date(Date.UTC(2026, 8, 1, 23, 0) + minute * 60_000);

			const azores = zoneDayLabel(instant, 'Atlantic/Azores');
			const stJohns = zoneDayLabel(instant, 'America/St_Johns');

			labels.add(`${azores}|${stJohns}`);
		}

		expect(built.filter((zone) => 'Atlantic/Azores' === zone)).toHaveLength(1);
		expect(built.filter((zone) => 'America/St_Johns' === zone)).toHaveLength(1);
		expect(labels.size).toBeGreaterThan(1);
	});

	it('never answers one zone with the formatter cached for another', () => {
		const instant = new Date('2026-09-01T18:14:00.000Z');

		for (let round = 0; 3 > round; round++) {
			expect(zoneDayLabel(instant, 'Asia/Kathmandu')).toBe('2026-09-01');
			expect(zoneDayLabel(instant, 'Pacific/Kiritimati')).toBe('2026-09-02');
			expect(zoneDayLabel(instant, 'Pacific/Honolulu')).toBe('2026-09-01');
			expect(zoneDayLabel(instant, 'Pacific/Auckland')).toBe('2026-09-02');
		}

		expect(zoneDayLabel(new Date('2026-09-01T18:15:00.000Z'), 'Asia/Kathmandu')).toBe('2026-09-02');
	});

	it('rejects an unknown zone every time instead of caching a broken formatter', () => {
		const instant = new Date('2026-09-02T12:00:00.000Z');

		expect(() => zoneDayLabel(instant, 'Mars/Olympus_Mons')).toThrow(RangeError);
		expect(() => zoneDayLabel(instant, 'Mars/Olympus_Mons')).toThrow(RangeError);
		expect(() => zoneDayLabel(instant, '')).toThrow(RangeError);
		expect(zoneDayLabel(instant, 'UTC')).toBe('2026-09-02');
	});

	it('rejects an invalid date instead of inventing a label', () => {
		expect(() => zoneDayLabel(new Date(Number.NaN), 'UTC')).toThrow(RangeError);
		expect(zoneDayLabel(new Date('2026-09-02T12:00:00.000Z'), 'UTC')).toBe('2026-09-02');
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

	it('returns the same label when moving zero days', () => {
		expect(addLabelDays('2026-03-29', 0)).toBe('2026-03-29');
	});

	it('ignores the daylight-saving days of any zone', () => {
		expect(addLabelDays('2026-03-28', 1)).toBe('2026-03-29');
		expect(addLabelDays('2026-03-29', 1)).toBe('2026-03-30');
		expect(addLabelDays('2026-10-25', 1)).toBe('2026-10-26');
	});
});

describe('diffLabelDays', () => {
	it('returns the signed number of civil days between labels', () => {
		expect(diffLabelDays('2026-09-01', '2026-09-04')).toBe(3);
		expect(diffLabelDays('2026-09-04', '2026-09-01')).toBe(-3);
	});

	it('returns zero for the same label', () => {
		expect(diffLabelDays('2026-09-01', '2026-09-01')).toBe(0);
	});

	it('counts whole days across daylight-saving changes, leap days and years', () => {
		expect(diffLabelDays('2026-03-28', '2026-03-30')).toBe(2);
		expect(diffLabelDays('2026-10-24', '2026-10-26')).toBe(2);
		expect(diffLabelDays('2028-02-28', '2028-03-01')).toBe(2);
		expect(diffLabelDays('2026-12-31', '2027-01-01')).toBe(1);
	});
});

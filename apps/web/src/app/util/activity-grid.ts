import type { TrainingActivityDay } from '@chesspecker/api-definitions';

import { fillActivityDays } from '@app/util/activity-day';
import { ScaleBounds, positiveBounds, toBucket } from '@app/util/scale';
import { addUtcDays, diffUtcDays, toIsoDate, utcMidnight } from '@app/util/utc-date';

export const DAYS_PER_WEEK = 7;
export const ACTIVITY_LEVELS = 4;

const LABELED_WEEKDAYS = new Set([0, 3, 6]);

export interface CyclePaceDay {
	readonly date: string;
	readonly done: number;
	readonly expected: number;
	readonly delta: number;
	readonly drift: number;
}

export interface ActivityCell {
	readonly date: string;
	readonly count: number;
	readonly level: 0 | 1 | 2 | 3 | 4;
}

export function buildActivityGrid(
	days: readonly TrainingActivityDay[],
	totalDays: number,
	today: Date = new Date(),
): readonly (ActivityCell | null)[][] {
	const counts = new Map(days.map((day) => [day.date, day.count]));
	const end = utcMidnight(today);
	const rangeStart = addUtcDays(end, -(totalDays - 1));
	const start = mostRecentMonday(rangeStart);
	const totalWeeks = Math.ceil((diffUtcDays(start, end) + 1) / DAYS_PER_WEEK);
	const bounds = positiveBounds(counts.values());

	return Array.from({ length: totalWeeks }, (_unused, week) =>
		Array.from({ length: DAYS_PER_WEEK }, (_unused, weekday) =>
			toCell(addUtcDays(start, week * DAYS_PER_WEEK + weekday), rangeStart, end, counts, bounds),
		),
	);
}

/** Exact day count of the last `months` calendar months, today included. */
export function activityRangeDays(months: number, today: Date = new Date()): number {
	const end = utcMidnight(today);
	const start = new Date(
		Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months, end.getUTCDate() + 1),
	);

	return diffUtcDays(start, end) + 1;
}

export function activityDaySeries(
	days: readonly TrainingActivityDay[],
	totalDays: number,
	today: Date = new Date(),
): readonly TrainingActivityDay[] {
	const end = utcMidnight(today);

	return fillActivityDays(days, addUtcDays(end, -(totalDays - 1)), end);
}

export function cyclePaceSeries(
	days: readonly TrainingActivityDay[],
	startedAt: string,
	puzzlesPerDay: number,
	today: Date = new Date(),
): readonly CyclePaceDay[] {
	const counts = new Map(days.map((day) => [day.date, day.count]));
	const start = utcMidnight(new Date(startedAt));
	const total = Math.max(0, diffUtcDays(start, utcMidnight(today)) + 1);
	let drift = 0;

	return Array.from({ length: total }, (_unused, index) => {
		const date = toIsoDate(addUtcDays(start, index));
		const done = counts.get(date) ?? 0;
		const delta = done - puzzlesPerDay;

		drift += delta;

		return { date, done, expected: puzzlesPerDay, delta, drift };
	});
}

export function filterActivityDays(
	days: readonly TrainingActivityDay[],
	totalDays: number,
	today: Date = new Date(),
): readonly TrainingActivityDay[] {
	const end = utcMidnight(today);
	const from = toIsoDate(addUtcDays(end, -(totalDays - 1)));

	return days.filter((day) => day.date >= from);
}

/**
 * One label per column, only where the column's Monday is the first one of a month the previous
 * columns hadn't reached — a range opening mid-month leaves that month unlabeled.
 */
export function monthAbbreviations(
	weekColumns: readonly (readonly (ActivityCell | null)[])[],
	locale: string,
): readonly (string | null)[] {
	const formatter = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
	let lastMonth = -1;

	return weekColumns.map((column) => {
		const firstCell = column.find((cell) => null !== cell);

		if (undefined === firstCell) {
			return null;
		}

		const date = new Date(firstCell.date);
		const month = date.getUTCMonth();

		if (month === lastMonth || !startsMonth(date)) {
			return null;
		}

		lastMonth = month;

		return capitalize(formatter.format(date));
	});
}

/** One label per weekday row, only on `LABELED_WEEKDAYS` — the rest stay blank. */
export function weekdayAbbreviations(
	locale: string,
	today: Date = new Date(),
): readonly (string | null)[] {
	const monday = mostRecentMonday(utcMidnight(today));
	const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });

	return Array.from({ length: DAYS_PER_WEEK }, (_unused, weekday) =>
		LABELED_WEEKDAYS.has(weekday)
			? capitalize(formatter.format(addUtcDays(monday, weekday)))
			: null,
	);
}

function toCell(
	date: Date,
	rangeStart: Date,
	end: Date,
	counts: ReadonlyMap<string, number>,
	bounds: ScaleBounds,
): ActivityCell | null {
	if (date > end || date < rangeStart) {
		return null;
	}

	const isoDate = toIsoDate(date);
	const count = counts.get(isoDate) ?? 0;

	return {
		date: isoDate,
		count,
		level: toBucket(count, bounds, ACTIVITY_LEVELS) as ActivityCell['level'],
	};
}

function startsMonth(date: Date): boolean {
	const monday = mostRecentMonday(date);

	return monday.getUTCMonth() === date.getUTCMonth() && DAYS_PER_WEEK >= monday.getUTCDate();
}

/** Lunes-primero: `getUTCDay()` da domingo=0, así que se desplaza para que lunes quede en 0. */
function mostRecentMonday(date: Date): Date {
	return addUtcDays(date, -((date.getUTCDay() + 6) % 7));
}

function capitalize(text: string): string {
	return 0 < text.length ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

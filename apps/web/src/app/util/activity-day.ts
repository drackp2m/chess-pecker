import type { TrainingActivityDay } from '@chesspecker/api-definitions';

import { addUtcDays, diffUtcDays, toIsoDate } from '@app/util/utc-date';

export function emptyActivityDay(date: string): TrainingActivityDay {
	return {
		date,
		done: 0,
		firstTry: 0,
		afterMiss: 0,
		shown: 0,
		foundClean: 0,
		foundHinted: 0,
		foundMissed: 0,
		foundMissedHinted: 0,
		revealed: 0,
		revealedHinted: 0,
		mistakes: 0,
		hints: 0,
		durationMs: 0,
	};
}

/**
 * Every day between two dates, the missing ones zeroed. The API only returns days with
 * activity, so without this a gap is indistinguishable from a day never asked for.
 */
export function fillActivityDays(
	days: readonly TrainingActivityDay[],
	from: Date,
	to: Date,
): readonly TrainingActivityDay[] {
	const byDate = new Map(days.map((day) => [day.date, day]));
	const total = diffUtcDays(from, to) + 1;

	return Array.from({ length: total }, (_unused, index) => {
		const date = toIsoDate(addUtcDays(from, index));

		return byDate.get(date) ?? emptyActivityDay(date);
	});
}

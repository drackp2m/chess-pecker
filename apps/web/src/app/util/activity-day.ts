import type { TrainingActivityDay } from '@chesspecker/api-definitions';

import { addUtcDays, diffUtcDays, toIsoDate } from '@app/util/utc-date';

export function emptyActivityDay(date: string): TrainingActivityDay {
	return {
		date,
		count: 0,
		solved: 0,
		failed: 0,
		resigned: 0,
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
 * Todos los días entre dos fechas, con los que falten a cero. El API sólo devuelve días
 * con actividad, así que sin esto un hueco no se distingue de un día nunca pedido.
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

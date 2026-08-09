import type { TrainingDailyBreakdown } from '@app/definition/training-daily.type';

const DAY_MS = 24 * 60 * 60 * 1000;
const REST_DAY_CHANCE = 0.22;

/** ToDo => throwaway stand-in until `GET /training/daily` exists. */
export function mockTrainingDaily(
	totalDays: number,
	today: Date = new Date(),
): readonly TrainingDailyBreakdown[] {
	const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

	return Array.from({ length: totalDays }, (_unused, index) => {
		const date = new Date(end - (totalDays - 1 - index) * DAY_MS);

		return toBreakdown(date.toISOString().slice(0, 10), index);
	});
}

function toBreakdown(date: string, seed: number): TrainingDailyBreakdown {
	if (REST_DAY_CHANCE > noise(seed)) {
		return { date, solved: 0, failed: 0, resigned: 0, mistakes: 0, hints: 0 };
	}

	const solved = 6 + Math.round(noise(seed + 1) * 14);
	const failed = Math.round(noise(seed + 2) * 6);
	const resigned = Math.round(noise(seed + 3) * 3);

	return {
		date,
		solved,
		failed,
		resigned,
		mistakes: failed * 2 + Math.round(noise(seed + 4) * 5),
		hints: resigned + Math.round(noise(seed + 5) * 4),
	};
}

/** Deterministic on purpose: a `Math.random` here would reshuffle on every recompute. */
function noise(seed: number): number {
	const value = Math.sin((seed + 1) * 12.9898) * 43758.5453;

	return value - Math.floor(value);
}

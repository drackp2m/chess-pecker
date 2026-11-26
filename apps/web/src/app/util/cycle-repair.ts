import { shuffle } from '@app/util/shuffle';

export interface CyclePlacement<T> {
	readonly item: T;
	readonly position: number;
}

export function planCycleRepair<T extends { readonly rating: number }>(
	unplaced: readonly T[],
	free: readonly number[],
): readonly CyclePlacement<T>[] {
	return pair(
		shuffle(unplaced).sort((one, other) => one.rating - other.rating),
		[...free].sort((one, other) => one - other),
	);
}

function pair<T>(items: readonly T[], positions: readonly number[]): CyclePlacement<T>[] {
	const placements: CyclePlacement<T>[] = [];

	for (const [index, position] of positions.entries()) {
		const item = items[index];

		if (undefined === item) {
			break;
		}

		placements.push({ item, position });
	}

	return placements;
}

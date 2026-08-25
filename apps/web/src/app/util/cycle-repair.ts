import { cycleBlock } from '@app/util/cycle-order';
import { shuffle } from '@app/util/shuffle';

export interface CycleBlockRange {
	readonly start: number;
	readonly end: number;
}

export interface CyclePlacement<T> {
	readonly item: T;
	readonly position: number;
}

export function cycleBlockRanges(
	set: readonly { readonly rating: number }[],
): Map<number, CycleBlockRange> {
	const sizes = new Map<number, number>();

	for (const item of set) {
		const block = cycleBlock(item.rating);

		sizes.set(block, (sizes.get(block) ?? 0) + 1);
	}

	const ranges = new Map<number, CycleBlockRange>();
	let start = 0;

	for (const block of [...sizes.keys()].sort((one, other) => one - other)) {
		const end = start + (sizes.get(block) ?? 0);

		ranges.set(block, { start, end });
		start = end;
	}

	return ranges;
}

export function planCycleRepair<T extends { readonly rating: number }>(
	set: readonly T[],
	unplaced: readonly T[],
	free: readonly number[],
): readonly CyclePlacement<T>[] {
	const inBlock = [...cycleBlockRanges(set)].flatMap(([block, range]) =>
		pair(
			shuffle(unplaced.filter((item) => block === cycleBlock(item.rating))),
			free.filter((position) => range.start <= position && position < range.end),
		),
	);

	const placed = new Set(inBlock.map((placement) => placement.item));
	const taken = new Set(inBlock.map((placement) => placement.position));

	return [
		...inBlock,
		...pair(
			shuffle(unplaced.filter((item) => !placed.has(item))),
			free.filter((position) => !taken.has(position)),
		),
	];
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

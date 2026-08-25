import { describe, expect, it } from 'vitest';

import { cycleBlock } from '@app/util/cycle-order';
import { cycleBlockRanges, planCycleRepair } from '@app/util/cycle-repair';

interface Entry {
	readonly uuid: string;
	readonly rating: number;
}

/** The shape of the real case: three rating blocks, 1000 exercises, one position each. */
function set(sizes: Readonly<Record<number, number>>): Entry[] {
	return Object.entries(sizes).flatMap(([rating, size]) =>
		Array.from({ length: size }, (_unused, index) => ({
			uuid: `${rating}-${index.toString()}`,
			rating: Number(rating),
		})),
	);
}

const CASE = set({ 1100: 344, 1200: 330, 1300: 326 });

describe('cycleBlockRanges', () => {
	it('lays the blocks out in rating order, back to back', () => {
		expect([...cycleBlockRanges(CASE)]).toEqual([
			[1100, { start: 0, end: 344 }],
			[1200, { start: 344, end: 674 }],
			[1300, { start: 674, end: 1000 }],
		]);
	});

	it('gives a single-block set the whole run of positions', () => {
		expect([...cycleBlockRanges(set({ 1500: 12 }))]).toEqual([[1500, { start: 0, end: 12 }]]);
	});

	it('has nothing to lay out for an empty set', () => {
		expect([...cycleBlockRanges([])]).toEqual([]);
	});
});

describe('planCycleRepair', () => {
	it('fills every free position with an exercise nobody else holds', () => {
		const placed = CASE.slice(0, 399);
		const unplaced = CASE.slice(399);
		const free = Array.from({ length: 601 }, (_unused, index) => 399 + index);

		const plan = planCycleRepair(CASE, unplaced, free);

		expect(plan).toHaveLength(601);
		expect(new Set(plan.map((one) => one.position)).size).toStrictEqual(601);
		expect(new Set(plan.map((one) => one.item)).size).toStrictEqual(601);
		expect(plan.some((one) => placed.includes(one.item))).toBe(false);
	});

	it('puts every exercise back inside the block its rating belongs to', () => {
		const kept = CASE.filter((_unused, index) => 0 === index % 3);
		const unplaced = CASE.filter((entry) => !kept.includes(entry));
		const taken = new Set(kept.map((entry) => CASE.indexOf(entry)));
		const free = CASE.map((_unused, index) => index).filter((index) => !taken.has(index));
		const ranges = cycleBlockRanges(CASE);

		const plan = planCycleRepair(CASE, unplaced, free);

		for (const { item, position } of plan) {
			const range = ranges.get(cycleBlock(item.rating));

			expect(position).toBeGreaterThanOrEqual(range?.start ?? -1);
			expect(position).toBeLessThan(range?.end ?? -1);
		}
	});

	it('shuffles inside the block, which is what the first pass did too', () => {
		const unplaced = CASE.slice(0, 344);
		const free = Array.from({ length: 344 }, (_unused, index) => index);

		const one = planCycleRepair(CASE, unplaced, free);
		const other = planCycleRepair(CASE, unplaced, free);

		expect(one.map((placement) => placement.item.uuid)).not.toEqual(
			other.map((placement) => placement.item.uuid),
		);
	});

	it('drops what does not fit its block onto whatever is still free', () => {
		const spare: Entry = { uuid: 'stray', rating: 1300 };
		const free = [0, 1];

		const plan = planCycleRepair(set({ 1100: 2 }), [spare], free);

		expect(plan).toEqual([{ item: spare, position: 0 }]);
	});

	it('writes nothing when no position is free', () => {
		expect(planCycleRepair(CASE, CASE.slice(0, 10), [])).toEqual([]);
	});
});

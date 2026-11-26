import { describe, expect, it } from 'vitest';

import { planCycleRepair } from '@app/util/cycle-repair';

interface Entry {
	readonly uuid: string;
	readonly rating: number;
}

function set(sizes: Readonly<Record<number, number>>): Entry[] {
	return Object.entries(sizes).flatMap(([rating, size]) =>
		Array.from({ length: size }, (_unused, index) => ({
			uuid: `${rating}-${index.toString()}`,
			rating: Number(rating),
		})),
	);
}

const CASE = set({ 1200: 250, 1230: 250, 1260: 250, 1290: 250 });

describe('planCycleRepair', () => {
	it('fills every free position with an exercise nobody else holds', () => {
		const placed = CASE.slice(0, 399);
		const unplaced = CASE.slice(399);
		const free = Array.from({ length: 601 }, (_unused, index) => 399 + index);

		const plan = planCycleRepair(unplaced, free);

		expect(plan).toHaveLength(601);
		expect(new Set(plan.map((one) => one.position)).size).toStrictEqual(601);
		expect(new Set(plan.map((one) => one.item)).size).toStrictEqual(601);
		expect(plan.some((one) => placed.includes(one.item))).toBe(false);
	});

	it('hands the free positions out from the easiest exercise to the hardest', () => {
		const unplaced = [999, 0, 500, 260, 760].flatMap((index) => CASE.slice(index, index + 1));
		const free = [900, 3, 450, 12, 600];

		const plan = planCycleRepair(unplaced, free);

		expect(plan.map((one) => [one.position, one.item.rating])).toEqual([
			[3, 1200],
			[12, 1230],
			[450, 1260],
			[600, 1290],
			[900, 1290],
		]);
	});

	it('shuffles the exercises that share a rating', () => {
		const unplaced = CASE.slice(0, 250);
		const free = Array.from({ length: 250 }, (_unused, index) => index);

		const one = planCycleRepair(unplaced, free);
		const other = planCycleRepair(unplaced, free);

		expect(one.map((placement) => placement.item.uuid)).not.toEqual(
			other.map((placement) => placement.item.uuid),
		);
	});

	it('leaves the surplus out when there are fewer positions than exercises', () => {
		const plan = planCycleRepair(CASE.slice(0, 10), [0, 1]);

		expect(plan).toHaveLength(2);
	});

	it('writes nothing when no position is free', () => {
		expect(planCycleRepair(CASE.slice(0, 10), [])).toEqual([]);
	});
});

import { describe, expect, it } from 'vitest';

import { CycleDifficulty } from '@app/definition/cycle-difficulty.constant';
import { CycleCandidate, buildCycleOrder, themeSimilarity } from '@app/util/cycle-order';

interface Entry {
	readonly id: string;
	readonly score: number;
	readonly theme: string;
}

const THEMES = [
	'fork',
	'pin',
	'mateIn1',
	'mateIn2',
	'sacrifice',
	'deflection',
	'rookEndgame',
	'advancedPawn',
	'kingsideAttack',
	'discoveredAttack',
];

function candidates(score: (index: number) => number): CycleCandidate<Entry>[] {
	return Array.from({ length: 1000 }, (_unused, index) => {
		const entry = {
			id: `P${index.toString()}`,
			score: score(index),
			theme: THEMES[index % THEMES.length] ?? 'fork',
		};

		return { item: entry, score: entry.score, themes: [entry.theme, 'crushing'] };
	});
}

function repeats(order: readonly Entry[]): number {
	return order.filter((entry, index) => entry.theme === order[index - 1]?.theme).length;
}

describe('buildCycleOrder', () => {
	it('places every exercise once', () => {
		const order = buildCycleOrder(candidates((index) => index));

		expect(order).toHaveLength(1000);
		expect(new Set(order.map((entry) => entry.id)).size).toStrictEqual(1000);
	});

	it('ramps from the lowest score to the highest, tier by tier', () => {
		const order = buildCycleOrder(candidates((index) => 1000 - index));
		const { tierSize, jitter } = CycleDifficulty;

		for (const [position, entry] of order.entries()) {
			const tier = Math.floor(position / tierSize);

			expect(entry.score).toBeGreaterThanOrEqual(tier * tierSize + 1 - 2 * jitter);
			expect(entry.score).toBeLessThanOrEqual((tier + 1) * tierSize + 2 * jitter);
		}
	});

	it('keeps exercises of the same kind apart', () => {
		const order = buildCycleOrder(candidates(() => 1250));

		expect(repeats(order)).toBeLessThan(30);
	});

	it('comes out different on every call', () => {
		const one = buildCycleOrder(candidates(() => 1250)).map((entry) => entry.id);
		const other = buildCycleOrder(candidates(() => 1250)).map((entry) => entry.id);

		expect(one).not.toEqual(other);
	});

	it('has nothing to order for an empty set', () => {
		expect(buildCycleOrder([])).toEqual([]);
	});
});

describe('themeSimilarity', () => {
	it('reads two identical sets as the same', () => {
		expect(themeSimilarity(new Set(['fork', 'short']), new Set(['fork', 'short']))).toBe(1);
	});

	it('reads two disjoint sets as unrelated', () => {
		expect(themeSimilarity(new Set(['fork']), new Set(['pin']))).toBe(0);
	});

	it('shares one theme out of three as a third', () => {
		expect(themeSimilarity(new Set(['fork', 'short']), new Set(['fork', 'long']))).toBeCloseTo(
			1 / 3,
		);
	});

	it('does not divide by zero on two empty sets', () => {
		expect(themeSimilarity(new Set(), new Set())).toBe(0);
	});
});

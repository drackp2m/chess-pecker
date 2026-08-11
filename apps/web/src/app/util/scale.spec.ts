import { describe, expect, it } from 'vitest';

import { linearScale, niceScale, positiveBounds, scaleTicks, toBucket } from '@app/util/scale';

describe('positiveBounds', () => {
	it('ignores anything that is not a positive count', () => {
		expect(positiveBounds([0, 4, -2, 9, 0])).toEqual({ min: 4, max: 9 });
	});

	it('collapses to zero when there is nothing to scale', () => {
		expect(positiveBounds([])).toEqual({ min: 0, max: 0 });
		expect(positiveBounds([0, 0])).toEqual({ min: 0, max: 0 });
	});
});

describe('toBucket', () => {
	it('keeps zero out of the filled buckets', () => {
		expect(toBucket(0, { min: 1, max: 10 }, 4)).toBe(0);
	});

	it('spreads the range over the filled buckets', () => {
		const bounds = { min: 1, max: 13 };

		expect(toBucket(1, bounds, 4)).toBe(1);
		expect(toBucket(13, bounds, 4)).toBe(4);
		expect(toBucket(7, bounds, 4)).toBe(3);
	});

	it('sends everything to the top bucket when every value is the same', () => {
		expect(toBucket(5, { min: 5, max: 5 }, 4)).toBe(4);
	});

	it('clamps values coming from outside the bounds', () => {
		expect(toBucket(99, { min: 1, max: 10 }, 4)).toBe(4);
	});
});

describe('linearScale', () => {
	it('maps the bounds onto the available size', () => {
		expect(linearScale(1, { min: 1, max: 5 }, 100)).toBe(0);
		expect(linearScale(3, { min: 1, max: 5 }, 100)).toBe(50);
		expect(linearScale(5, { min: 1, max: 5 }, 100)).toBe(100);
	});

	it('fills the size when the range is flat', () => {
		expect(linearScale(5, { min: 5, max: 5 }, 100)).toBe(100);
	});
});

describe('niceScale', () => {
	it('rounds the maximum up to a round step', () => {
		expect(niceScale({ min: 0, max: 7 }, 4)).toEqual({ min: 0, max: 8, step: 2 });
		expect(niceScale({ min: 0, max: 30 }, 4)).toEqual({ min: 0, max: 30, step: 10 });
	});

	it('grows on both sides when the values cross zero', () => {
		expect(niceScale({ min: -3, max: 5 }, 4)).toEqual({ min: -4, max: 6, step: 2 });
	});

	it('hangs the whole domain below zero when nothing is positive', () => {
		expect(niceScale({ min: -5, max: 0 }, 4)).toEqual({ min: -6, max: 0, step: 2 });
	});

	it('collapses to the baseline without data', () => {
		expect(niceScale({ min: 0, max: 0 }, 4)).toEqual({ min: 0, max: 0, step: 0 });
		expect(niceScale({ min: 0, max: 10 }, 0)).toEqual({ min: 0, max: 0, step: 0 });
	});
});

describe('scaleTicks', () => {
	it('walks the domain step by step', () => {
		expect(scaleTicks(niceScale({ min: 0, max: 7 }, 4))).toEqual([0, 2, 4, 6, 8]);
	});

	it('puts the zero on a tick of its own when the domain crosses it', () => {
		expect(scaleTicks(niceScale({ min: -3, max: 5 }, 4))).toEqual([-4, -2, 0, 2, 4, 6]);
	});

	it('keeps the fractional steps free of float noise', () => {
		expect(scaleTicks(niceScale({ min: 0, max: 0.9 }, 4))).toEqual([0, 0.25, 0.5, 0.75, 1]);
	});

	it('has nothing but a baseline to show without data', () => {
		expect(scaleTicks({ min: 0, max: 0, step: 0 })).toEqual([0]);
	});
});

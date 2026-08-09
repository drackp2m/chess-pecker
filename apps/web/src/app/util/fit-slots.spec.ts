import { describe, expect, it } from 'vitest';

import { fitSlots } from '@app/util/fit-slots';

describe('fitSlots', () => {
	it('drops the remainder in fixed mode', () => {
		expect(fitSlots(105, 10, 50, 'fixed')).toEqual({ count: 10, size: 10 });
	});

	it('shares the whole width in stretch mode', () => {
		expect(fitSlots(105, 10, 50, 'stretch')).toEqual({ count: 10, size: 10.5 });
	});

	it('never asks for more slots than there are', () => {
		expect(fitSlots(1000, 10, 7, 'fixed')).toEqual({ count: 7, size: 10 });
		expect(fitSlots(1000, 10, 7, 'stretch')).toEqual({ count: 7, size: 1000 / 7 });
	});

	it('keeps one slot when not even one fits', () => {
		expect(fitSlots(4, 10, 50, 'fixed')).toEqual({ count: 1, size: 10 });
		expect(fitSlots(4, 10, 50, 'stretch')).toEqual({ count: 1, size: 10 });
	});

	it('absorbs subpixel rounding instead of losing a slot', () => {
		expect(fitSlots(99.99, 10, 50, 'fixed').count).toBe(10);
	});

	it('fits nothing while the container or the data is still empty', () => {
		expect(fitSlots(0, 10, 50, 'fixed')).toEqual({ count: 0, size: 0 });
		expect(fitSlots(500, 10, 0, 'fixed')).toEqual({ count: 0, size: 0 });
		expect(fitSlots(500, 0, 50, 'fixed')).toEqual({ count: 0, size: 0 });
	});
});

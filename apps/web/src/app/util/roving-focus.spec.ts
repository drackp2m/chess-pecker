import { describe, expect, it } from 'vitest';

import {
	RovingPosition,
	lastRovingPosition,
	moveRovingFocus,
	rovingIndex,
} from '@app/util/roving-focus';

const SIZE = { columns: 4, rows: 3 };
const ALL = (): boolean => true;

describe('moveRovingFocus', () => {
	const from: RovingPosition = { column: 1, row: 1 };

	it('walks the grid with the arrow keys', () => {
		expect(moveRovingFocus('ArrowRight', from, SIZE, ALL)).toEqual({ column: 2, row: 1 });
		expect(moveRovingFocus('ArrowLeft', from, SIZE, ALL)).toEqual({ column: 0, row: 1 });
		expect(moveRovingFocus('ArrowUp', from, SIZE, ALL)).toEqual({ column: 1, row: 0 });
		expect(moveRovingFocus('ArrowDown', from, SIZE, ALL)).toEqual({ column: 1, row: 2 });
	});

	it('stays put at the edges instead of wrapping around', () => {
		expect(moveRovingFocus('ArrowUp', { column: 0, row: 0 }, SIZE, ALL)).toBeNull();
		expect(moveRovingFocus('ArrowRight', { column: 3, row: 0 }, SIZE, ALL)).toBeNull();
	});

	it('skips over the cells that carry no data', () => {
		const isEnabled = (position: RovingPosition): boolean => 3 === position.column;

		expect(moveRovingFocus('ArrowRight', { column: 0, row: 1 }, SIZE, isEnabled)).toEqual({
			column: 3,
			row: 1,
		});
	});

	it('gives up when nothing ahead is enabled', () => {
		const isEnabled = (position: RovingPosition): boolean => 0 === position.column;

		expect(moveRovingFocus('ArrowRight', { column: 0, row: 1 }, SIZE, isEnabled)).toBeNull();
	});

	it('jumps to the ends of the row with Home and End', () => {
		expect(moveRovingFocus('Home', from, SIZE, ALL)).toEqual({ column: 0, row: 1 });
		expect(moveRovingFocus('End', from, SIZE, ALL)).toEqual({ column: 3, row: 1 });
	});

	it('ignores any other key', () => {
		expect(moveRovingFocus('Enter', from, SIZE, ALL)).toBeNull();
		expect(moveRovingFocus('a', from, SIZE, ALL)).toBeNull();
	});
});

describe('lastRovingPosition', () => {
	it('finds the last enabled cell in reading order', () => {
		expect(lastRovingPosition(SIZE, ALL)).toEqual({ column: 3, row: 2 });
	});

	it('skips the trailing cells that carry no data', () => {
		const isEnabled = (position: RovingPosition): boolean =>
			3 > position.column || 1 > position.row;

		expect(lastRovingPosition(SIZE, isEnabled)).toEqual({ column: 3, row: 0 });
	});

	it('returns nothing on an empty grid', () => {
		expect(lastRovingPosition({ columns: 0, rows: 0 }, ALL)).toBeNull();
	});
});

describe('rovingIndex', () => {
	it('flattens the position the way the cells are rendered', () => {
		expect(rovingIndex({ column: 0, row: 0 }, SIZE)).toBe(0);
		expect(rovingIndex({ column: 2, row: 1 }, SIZE)).toBe(7);
	});
});

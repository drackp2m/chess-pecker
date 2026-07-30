import { describe, expect, it } from 'vitest';

import {
	buildPromotionChoices,
	hasPassedThreshold,
	indexAtOrder,
	resolveRelease,
	slideOffset,
	squareAtPoint,
} from '@app/component/chess-board/board-geometry';

/** An 800px board at the origin: every square is exactly 100px. */
const RECT = { left: 0, top: 0, width: 800, height: 800 } as DOMRect;

describe('indexAtOrder', () => {
	it('reads the board straight through for white', () => {
		expect(indexAtOrder(0, 'white')).toBe(0);
		expect(indexAtOrder(63, 'white')).toBe(63);
	});

	it('mirrors it for black', () => {
		expect(indexAtOrder(0, 'black')).toBe(63);
		expect(indexAtOrder(63, 'black')).toBe(0);
	});
});

describe('squareAtPoint', () => {
	it('finds the square under the pointer from white side', () => {
		expect(squareAtPoint(RECT, { x: 50, y: 50 }, 'white')).toBe('a8');
		expect(squareAtPoint(RECT, { x: 750, y: 750 }, 'white')).toBe('h1');
		expect(squareAtPoint(RECT, { x: 450, y: 450 }, 'white')).toBe('e4');
	});

	it('accounts for a flipped board', () => {
		expect(squareAtPoint(RECT, { x: 50, y: 50 }, 'black')).toBe('h1');
		expect(squareAtPoint(RECT, { x: 750, y: 750 }, 'black')).toBe('a8');
	});

	it('returns nothing when the pointer is off the board', () => {
		expect(squareAtPoint(RECT, { x: -10, y: 50 }, 'white')).toBeUndefined();
		expect(squareAtPoint(RECT, { x: 50, y: 900 }, 'white')).toBeUndefined();
	});
});

describe('slideOffset', () => {
	it('measures the travel in whole squares', () => {
		// e2 to e4 is two ranks up the board, so it enters from 200% below.
		expect(slideOffset('e2', 'e4', 'white')).toEqual({ x: 0, y: 200 });
		expect(slideOffset('a1', 'h1', 'white')).toEqual({ x: -700, y: 0 });
	});

	it('inverts the travel on a flipped board', () => {
		expect(slideOffset('e2', 'e4', 'black')).toEqual({ x: 0, y: -200 });
	});
});

describe('hasPassedThreshold', () => {
	it('ignores a jittery press but accepts a real drag', () => {
		expect(hasPassedThreshold({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
		expect(hasPassedThreshold({ x: 0, y: 0 }, { x: 20, y: 0 })).toBe(true);
	});
});

describe('resolveRelease', () => {
	const base = { from: 'e2', released: 'e4', wasDrag: false, isClickEnabled: true } as const;

	it('acts on a tap, whatever sits on the target square', () => {
		// The regression: a capture target holds a piece, an empty one does not, and
		// both must behave the same on release.
		expect(resolveRelease({ ...base, released: 'e4' })).toBe('e4');
		expect(resolveRelease({ ...base, released: 'd3' })).toBe('d3');
	});

	it('acts on a drop that landed somewhere new', () => {
		expect(resolveRelease({ ...base, wasDrag: true })).toBe('e4');
	});

	it('keeps the piece selected when a drag ends where it began', () => {
		expect(
			resolveRelease({ from: 'e2', released: 'e2', wasDrag: true, isClickEnabled: true }),
		).toBeUndefined();
	});

	it('lets a tap on the origin square toggle the selection', () => {
		expect(
			resolveRelease({ from: 'e2', released: 'e2', wasDrag: false, isClickEnabled: true }),
		).toBe('e2');
	});

	it('ignores a tap when click input is turned off', () => {
		expect(resolveRelease({ ...base, isClickEnabled: false })).toBeUndefined();
	});

	it('still honours a drop when click input is turned off', () => {
		expect(resolveRelease({ ...base, wasDrag: true, isClickEnabled: false })).toBe('e4');
	});

	it('ignores a release off the board or with no press behind it', () => {
		expect(resolveRelease({ ...base, released: undefined })).toBeUndefined();
		expect(resolveRelease({ ...base, from: undefined })).toBeUndefined();
	});
});

describe('buildPromotionChoices', () => {
	const choices = buildPromotionChoices(['queen', 'rook', 'bishop', 'knight']);

	it('lays the pieces out over two ranks in reading order', () => {
		expect(choices.map(({ piece }) => piece)).toEqual(['queen', 'rook', 'bishop', 'knight']);
	});

	it('alternates the square colours from a dark a1', () => {
		// a2 b2 on top, a1 b1 underneath.
		expect(choices.map(({ isLight }) => isLight)).toEqual([true, false, false, true]);
	});

	it('labels the left column with ranks and the bottom row with files', () => {
		expect(choices.map(({ rankLabel }) => rankLabel)).toEqual(['2', undefined, '1', undefined]);
		expect(choices.map(({ fileLabel }) => fileLabel)).toEqual([undefined, undefined, 'a', 'b']);
	});
});

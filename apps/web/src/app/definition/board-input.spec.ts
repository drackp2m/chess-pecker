import { describe, expect, it } from 'vitest';

import { buildMoveInputMethods, normalizeMoveInputMethods } from '@app/definition/board-input.type';

describe('buildMoveInputMethods', () => {
	it('keeps the methods that are ticked, in a stable order', () => {
		expect(buildMoveInputMethods(true, true)).toEqual(['click', 'drag']);
		expect(buildMoveInputMethods(true, false)).toEqual(['click']);
		expect(buildMoveInputMethods(false, true)).toEqual(['drag']);
	});

	it('falls back to clicking rather than leaving the board unplayable', () => {
		expect(buildMoveInputMethods(false, false)).toEqual(['click']);
	});
});

describe('normalizeMoveInputMethods', () => {
	it('reads a stored selection back', () => {
		expect(normalizeMoveInputMethods(['drag'])).toEqual(['drag']);
		expect(normalizeMoveInputMethods(['drag', 'click'])).toEqual(['click', 'drag']);
	});

	it('drops values it does not recognise', () => {
		expect(normalizeMoveInputMethods(['drag', 'telepathy'])).toEqual(['drag']);
	});

	it('falls back when the stored value is empty or not a list', () => {
		expect(normalizeMoveInputMethods([])).toEqual(['click']);
		expect(normalizeMoveInputMethods(undefined)).toEqual(['click']);
		expect(normalizeMoveInputMethods('drag')).toEqual(['click']);
	});

	it('accepts a caller-supplied fallback', () => {
		expect(normalizeMoveInputMethods(undefined, ['click', 'drag'])).toEqual(['click', 'drag']);
	});
});

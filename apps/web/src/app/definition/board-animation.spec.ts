import { describe, expect, it } from 'vitest';

import {
	BoardTransitionKind,
	MOVE_ANIMATIONS,
	shouldAnimate,
} from '@app/definition/board-animation.type';

const KINDS: readonly BoardTransitionKind[] = ['played', 'forward', 'backward'];

describe('shouldAnimate', () => {
	it('animates everything on "always"', () => {
		expect(KINDS.map((kind) => shouldAnimate(kind, 'always'))).toEqual([true, true, true]);
	});

	it('skips only rewinding on "forward"', () => {
		expect(KINDS.map((kind) => shouldAnimate(kind, 'forward'))).toEqual([true, true, false]);
	});

	it('animates only a freshly played move on "first"', () => {
		expect(KINDS.map((kind) => shouldAnimate(kind, 'first'))).toEqual([true, false, false]);
	});

	it('animates nothing on "never"', () => {
		expect(KINDS.map((kind) => shouldAnimate(kind, 'never'))).toEqual([false, false, false]);
	});

	it('is a ladder: each level animates a subset of the one above it', () => {
		const animated = MOVE_ANIMATIONS.map(
			(setting) => KINDS.filter((kind) => shouldAnimate(kind, setting)).length,
		);

		expect(animated).toEqual([3, 2, 1, 0]);
	});
});

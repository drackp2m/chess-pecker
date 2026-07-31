import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { createBoardSlide } from '@app/component/chess-board/board-slide';
import {
	BoardTransition,
	BoardTransitionKind,
	MoveAnimation,
} from '@app/definition/board-animation.type';
import { PieceColor } from '@app/definition/chess.type';

let lastTick = 0;

/** A move across the board, under a tick of its own the way the stores hand them out. */
function transitionOf(kind: BoardTransitionKind = 'played'): BoardTransition {
	lastTick += 1;

	return { from: 'a1', to: 'h1', kind, tick: lastTick };
}

function createBoard(animation: MoveAnimation = 'always') {
	const input = {
		transition: signal<BoardTransition | undefined>(undefined),
		animation: signal<MoveAnimation>(animation),
		orientation: signal<PieceColor>('white'),
	};

	return { ...input, slide: createBoardSlide(input) };
}

/** The board is redrawn constantly; only what it holds at each read reaches a piece. */
function readTwice<T>(source: () => T): [T, T] {
	return [source(), source()];
}

describe('createBoardSlide', () => {
	it('slides only the square the move landed on', () => {
		const board = createBoard();

		expect(board.slide()).toBeUndefined();

		board.transition.set(transitionOf());

		expect(board.slide()?.to).toBe('h1');
		expect(board.slide()?.slide).toMatchObject({ x: -700, y: 0 });
	});

	it('keys the slide by the tick alone, so a redraw cannot pass it off as a new one', () => {
		const board = createBoard();

		board.transition.set(transitionOf());

		const [first, second] = readTwice(() => board.slide()?.slide.key);

		expect(first).toBe(second);
		expect(first).toBe(board.transition()?.tick);
	});

	it('withholds the slide the setting had no time for', () => {
		const board = createBoard('never');

		board.transition.set(transitionOf());

		expect(board.slide()).toBeUndefined();
	});

	/**
	 * The reason the setting is read outside the reactive graph: the move is long over
	 * and the piece is standing on its square, so turning the animation on now would
	 * have it come sailing in from a square it left minutes ago.
	 */
	it('does not replay a move already on screen when the setting is turned up', () => {
		const board = createBoard('never');

		board.transition.set(transitionOf());

		expect(board.slide()).toBeUndefined();

		board.animation.set('always');

		expect(board.slide()).toBeUndefined();
	});

	it('applies the new setting from the next move on', () => {
		const board = createBoard('never');

		board.transition.set(transitionOf());
		board.animation.set('always');
		board.transition.set(transitionOf());

		expect(board.slide()?.to).toBe('h1');
	});

	it('does not replay the last move when the board is flipped', () => {
		const board = createBoard();

		board.transition.set(transitionOf());

		const before = board.slide()?.slide;

		board.orientation.set('black');

		// Same slide, same key: the piece knows it by that key and will not run it twice.
		expect(board.slide()?.slide).toEqual(before);
	});

	it('measures the next move against the orientation it is played under', () => {
		const board = createBoard();

		board.transition.set(transitionOf());
		board.orientation.set('black');
		board.transition.set(transitionOf());

		// Travelling the same way on a flipped board means coming from the other side.
		expect(board.slide()?.slide).toMatchObject({ x: 700, y: 0 });
	});

	it('holds each level of the policy to the kind of move it covers', () => {
		const kinds: readonly BoardTransitionKind[] = ['played', 'forward', 'backward'];
		const animated = (['always', 'forward', 'first', 'never'] as const).map((animation) =>
			kinds.filter((kind) => {
				const board = createBoard(animation);

				board.transition.set(transitionOf(kind));

				return undefined !== board.slide();
			}),
		);

		expect(animated).toEqual([kinds, ['played', 'forward'], ['played'], []]);
	});
});

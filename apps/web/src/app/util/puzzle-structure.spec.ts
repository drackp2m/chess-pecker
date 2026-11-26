import { describe, expect, it } from 'vitest';

import { puzzleStructure } from '@app/util/puzzle-structure';

describe('puzzleStructure', () => {
	it('reads a quiet pawn push in a bare endgame', () => {
		expect(
			puzzleStructure({
				fen: '6K1/2p5/8/2p4P/8/8/2k5/8 b - - 0 50',
				moves: ['c2d3', 'h5h6', 'c5c4', 'h6h7', 'c4c3', 'h7h8q'],
			}),
		).toEqual({ playerMoves: 3, isQuietStart: true, material: 0 });
	});

	it('does not call a checking first move quiet', () => {
		expect(
			puzzleStructure({
				fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1',
				moves: ['g8f8', 'a1a8'],
			}),
		).toEqual({ playerMoves: 1, isQuietStart: false, material: 1 });
	});

	it('does not call a line it cannot play quiet', () => {
		expect(
			puzzleStructure({ fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1', moves: ['a1a1', 'b2b3'] }),
		).toMatchObject({ isQuietStart: false });
	});

	it('reads nothing from an exercise missing on this device', () => {
		expect(puzzleStructure(undefined)).toEqual({
			playerMoves: 0,
			isQuietStart: false,
			material: 0,
		});
	});
});

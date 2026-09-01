import { describe, expect, it } from 'vitest';

import {
	PIECE_ELEVATIONS,
	pieceElevation,
	squareElevation,
} from '@app/component/chess-board/board-stacking';
import { Piece, PieceColor, PieceType } from '@app/definition/chess.type';

const TYPES: readonly PieceType[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
const COLORS: readonly PieceColor[] = ['white', 'black'];

function every(): Piece[] {
	return TYPES.flatMap((type) => COLORS.map((color) => ({ type, color })));
}

function elevationOf(color: PieceColor, type: PieceType): number {
	return pieceElevation({ type, color });
}

describe('pieceElevation', () => {
	it('gives every piece a level of its own', () => {
		const levels = every().map((piece) => pieceElevation(piece));

		expect(new Set(levels).size).toBe(PIECE_ELEVATIONS);
		expect(Math.min(...levels)).toBe(1);
		expect(Math.max(...levels)).toBe(PIECE_ELEVATIONS);
	});

	it('stacks them by force, from the king down to the pawn', () => {
		for (const color of COLORS) {
			const climbing = [...TYPES].reverse().map((type) => elevationOf(color, type));

			expect(climbing).toEqual([...climbing].sort((left, right) => left - right));
		}
	});

	it('settles the tie between equal force in white’s favour', () => {
		for (const type of TYPES) {
			expect(elevationOf('white', type)).toBeGreaterThan(elevationOf('black', type));
		}
	});

	/** The two ends of the scale, which is the whole of what a player ever notices. */
	it('rides the white king over everything and puts the black pawn under it', () => {
		const levels = every().map((piece) => pieceElevation(piece));

		expect(elevationOf('white', 'king')).toBe(Math.max(...levels));
		expect(elevationOf('black', 'pawn')).toBe(Math.min(...levels));
	});

	it('keeps force ahead of colour, so a black king outranks a white queen', () => {
		expect(elevationOf('black', 'king')).toBeGreaterThan(elevationOf('white', 'queen'));
		expect(elevationOf('black', 'pawn')).toBeLessThan(elevationOf('white', 'pawn'));
	});
});

describe('squareElevation', () => {
	it('leaves an empty square without a level', () => {
		expect(squareElevation(undefined, false)).toBeUndefined();
		expect(squareElevation(undefined, true)).toBeUndefined();
	});

	it('gives a piece standing still the level its force earns', () => {
		for (const piece of every()) {
			expect(squareElevation(piece, false)).toBe(pieceElevation(piece));
		}
	});

	it('rides the piece on the move over every piece standing still', () => {
		const standing = every().map((piece) => squareElevation(piece, false) ?? 0);

		for (const piece of every()) {
			expect(squareElevation(piece, true)).toBeGreaterThan(Math.max(...standing));
		}
	});

	it('gives every piece on the move the same level, whatever its force', () => {
		const moving = every().map((piece) => squareElevation(piece, true));

		expect(new Set(moving).size).toBe(1);
		expect(moving[0]).toBe(PIECE_ELEVATIONS + 1);
	});
});

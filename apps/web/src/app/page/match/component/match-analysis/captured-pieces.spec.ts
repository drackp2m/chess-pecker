import { describe, expect, it } from 'vitest';

import { ChessMoveRecord, PieceColor, PieceType } from '@app/definition/chess.type';
import { capturedBy, materialOf } from '@app/page/match/component/match-analysis/captured-pieces';

function move(color: PieceColor, captured: PieceType | undefined): ChessMoveRecord {
	return {
		from: 'e4',
		to: 'd5',
		piece: 'pawn',
		color,
		captured,
		promotion: undefined,
		castling: undefined,
		isEnPassant: false,
		san: '',
		fullmoveNumber: 1,
	};
}

describe('capturedBy', () => {
	const history = [
		move('white', 'queen'),
		move('black', 'pawn'),
		move('white', 'pawn'),
		move('white', 'bishop'),
		move('black', undefined),
		move('white', 'knight'),
		move('white', 'pawn'),
		move('white', undefined),
	];

	it('groups what a side took by type, cheapest first', () => {
		expect(capturedBy(history, 'white')).toEqual([
			{ type: 'pawn', pieces: ['pawn', 'pawn'] },
			{ type: 'knight', pieces: ['knight'] },
			{ type: 'bishop', pieces: ['bishop'] },
			{ type: 'queen', pieces: ['queen'] },
		]);
	});

	it('only counts the captures of the side asked about', () => {
		expect(capturedBy(history, 'black')).toEqual([{ type: 'pawn', pieces: ['pawn'] }]);
		expect(capturedBy([], 'black')).toEqual([]);
	});
});

describe('materialOf', () => {
	it('adds up the value of every captured piece', () => {
		expect(
			materialOf([
				{ type: 'pawn', pieces: ['pawn', 'pawn'] },
				{ type: 'knight', pieces: ['knight'] },
				{ type: 'queen', pieces: ['queen'] },
			]),
		).toBe(14);
		expect(materialOf([])).toBe(0);
	});
});

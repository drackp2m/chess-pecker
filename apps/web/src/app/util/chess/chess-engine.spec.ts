import { describe, expect, it } from 'vitest';

import { ChessMove, ChessPosition } from '@app/definition/chess.type';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessNotation } from '@app/util/chess/chess-notation';

/** Counts every leaf node of the move tree: the standard move-generation benchmark. */
function perft(position: ChessPosition, depth: number): number {
	const moves = ChessMoveGenerator.legalMoves(position);

	if (1 >= depth) {
		return 1 === depth ? moves.length : 1;
	}

	return moves.reduce(
		(total, move) => total + perft(ChessBoard.apply(position, move), depth - 1),
		0,
	);
}

/** Resolves notation and fails the test outright when it is not playable. */
function requireMove(position: ChessPosition, notation: string): ChessMove {
	const move = ChessNotation.parse(position, notation);

	if (undefined === move) {
		throw new Error(`"${notation}" should be legal in ${ChessFen.serialize(position)}`);
	}

	return move;
}

function play(position: ChessPosition, notations: readonly string[]): ChessPosition {
	return notations.reduce(
		(current, notation) => ChessBoard.apply(current, requireMove(current, notation)),
		position,
	);
}

describe('chess move generation (perft)', () => {
	it.each([
		[1, 20],
		[2, 400],
		[3, 8902],
	])('counts %i-ply nodes from the initial position', (depth, expected) => {
		expect(perft(ChessFen.initial(), depth)).toBe(expected);
	});

	it.each([
		[1, 48],
		[2, 2039],
	])('counts %i-ply nodes from Kiwipete (castling and pins)', (depth, expected) => {
		const position = ChessFen.parse(
			'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
		);

		expect(perft(position, depth)).toBe(expected);
	});

	it.each([
		[1, 14],
		[2, 191],
		[3, 2812],
	])('counts %i-ply nodes from an en passant endgame', (depth, expected) => {
		const position = ChessFen.parse('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');

		expect(perft(position, depth)).toBe(expected);
	});

	it.each([
		[1, 6],
		[2, 264],
		[3, 9467],
	])('counts %i-ply nodes from a promotion-heavy position', (depth, expected) => {
		const position = ChessFen.parse(
			'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
		);

		expect(perft(position, depth)).toBe(expected);
	});
});

describe('FEN', () => {
	it('round-trips the initial position', () => {
		const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

		expect(ChessFen.serialize(ChessFen.parse(fen))).toBe(fen);
	});

	it('round-trips a midgame position with an en passant target', () => {
		const fen = 'rnbqkbnr/pp1ppppp/8/2pP4/8/8/PPP1PPPP/RNBQKBNR w KQkq c6 0 3';

		expect(ChessFen.serialize(ChessFen.parse(fen))).toBe(fen);
	});

	it('rejects a position without both kings', () => {
		expect(ChessFen.isValid('8/8/8/8/8/8/8/K7 w - - 0 1')).toBe(false);
		expect(ChessFen.isValid('8/8/8/8/8/8/8/K6k w - - 0 1')).toBe(true);
	});
});

describe('algebraic notation', () => {
	it('plays a full opening written in standard notation', () => {
		const position = play(ChessFen.initial(), ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);

		expect(ChessFen.serialize(position)).toBe(
			'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
		);
	});

	it('accepts the long form and castling', () => {
		const position = play(ChessFen.initial(), ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6']);
		const castled = play(position, ['O-O']);

		expect(ChessBoard.pieceAt(castled, 'g1')).toEqual({ type: 'king', color: 'white' });
		expect(ChessBoard.pieceAt(castled, 'f1')).toEqual({ type: 'rook', color: 'white' });
	});

	it('writes disambiguation, captures and promotion', () => {
		// Knights on d5 and f5 both reach e7, so that move needs its origin file.
		const position = ChessFen.parse('r3k2r/1P6/8/3N1N2/8/8/8/4K3 w kq - 0 1');
		const describe = (notation: string): string =>
			ChessNotation.describe(position, requireMove(position, notation));

		expect(describe('Nde7')).toBe('Nde7');
		expect(describe('Nfe7')).toBe('Nfe7');
		expect(describe('Nf6')).toBe('Nf6+');
		// Both promotions land on the eighth rank and check the king on e8.
		expect(describe('b8=Q')).toBe('b8=Q+');
		expect(describe('bxa8=Q')).toBe('bxa8=Q+');
	});

	it('marks checkmate on the move that delivers it', () => {
		const position = ChessFen.parse(
			'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2',
		);
		expect(ChessNotation.describe(position, requireMove(position, 'Qh4'))).toBe('Qh4#');
	});

	it('marks a plain check', () => {
		const position = ChessFen.parse('4k3/8/8/8/8/8/8/R3K3 w Q - 0 1');
		expect(ChessNotation.describe(position, requireMove(position, 'Ra8'))).toBe('Ra8+');
	});

	it('reports checkmate and stalemate as terminal states', () => {
		expect(ChessMoveGenerator.status(ChessFen.parse('7k/5QK1/8/8/8/8/8/8 b - - 0 1'))).toBe(
			'checkmate',
		);
		expect(ChessMoveGenerator.status(ChessFen.parse('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toBe(
			'stalemate',
		);
	});

	it('refuses an ambiguous or illegal move', () => {
		const position = ChessFen.parse('r3k2r/1P6/8/3N1N2/8/8/8/4K3 w kq - 0 1');

		expect(ChessNotation.parse(position, 'Ne7')).toBeUndefined();
		expect(ChessNotation.parse(position, 'e4')).toBeUndefined();
	});
});

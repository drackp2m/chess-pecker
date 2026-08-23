import { describe, expect, it } from 'vitest';

import { ChessMove, ChessPosition, Square } from '@app/definition/chess.type';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessNotation } from '@app/util/chess/chess-notation';
import { ChessSquare } from '@app/util/chess/chess-square';

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

/** Replays a line the way the match store does: keeping every position behind it. */
function replay(notations: readonly string[]): {
	position: ChessPosition;
	history: ChessPosition[];
} {
	const history: ChessPosition[] = [];
	let position = ChessFen.initial();

	for (const notation of notations) {
		history.push(position);
		position = ChessBoard.apply(position, requireMove(position, notation));
	}

	return { position, history };
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

	it('writes an en passant target it does not key on', () => {
		const pushed = play(ChessFen.initial(), ['e4']);
		const noTarget = ChessFen.parse('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');

		// The field is part of the FEN either way, but no black pawn can answer it.
		expect(ChessFen.serialize(pushed)).toContain(' e3 ');
		expect(ChessFen.positionKey(pushed)).toBe(ChessFen.positionKey(noTarget));
	});

	it('keys on an en passant target a pawn can answer', () => {
		const pushed = play(ChessFen.initial(), ['e4', 'c5', 'e5', 'd5']);

		expect(ChessFen.positionKey(pushed)).toContain(' d6');
	});

	it.each([
		// The d4 pawn is pinned down the d-file by the rook, so `dxe3` is not a move.
		['a pawn pinned against its king', '3k4/8/8/8/3pP3/8/8/3R3K b - e3 0 1'],
		// `dxe6` empties d5 *and* e5 at once, which opens the rank onto the white king.
		// No pawn is pinned here: it is the capture that is illegal, not the piece.
		['a capture that clears the rank onto its own king', '7k/8/8/K2Pp2r/8/8/8/8 w - e6 0 1'],
	])('does not key on an en passant target answered only by %s', (_case, fen) => {
		const position = ChessFen.parse(fen);
		const noTarget = ChessFen.parse(fen.replace(/ (e3|e6) /, ' - '));

		expect(ChessFen.positionKey(position)).toBe(ChessFen.positionKey(noTarget));
	});

	it('rejects a position without both kings', () => {
		expect(ChessFen.isValid('8/8/8/8/8/8/8/K7 w - - 0 1')).toBe(false);
		expect(ChessFen.isValid('8/8/8/8/8/8/8/K6k w - - 0 1')).toBe(true);
	});

	it('rejects a placement that does not describe sixty-four squares', () => {
		expect(ChessFen.isValid('8/8/8/8/KQkq w - - 0 1')).toBe(false);
		expect(ChessFen.isValid('8/8/8/8/8/8/8/K6kq w - - 0 1')).toBe(false);
		expect(ChessFen.isValid('8/8/8/8/8/8/8/K5k w - - 0 1')).toBe(false);
	});

	it('rejects an en passant field that is not a square on the board', () => {
		expect(ChessFen.isValid('8/8/8/8/8/8/8/K6k w - z3 0 1')).toBe(false);
		expect(ChessFen.isValid('8/8/8/8/8/8/8/K6k w - e3 0 1')).toBe(true);
	});

	it('rejects a move counter that is not a number', () => {
		expect(ChessFen.isValid('8/8/8/8/8/8/8/K6k w - - x 1')).toBe(false);
		expect(ChessFen.isValid('8/8/8/8/8/8/8/K6k w - - 0 x')).toBe(false);
	});
});

describe('draws', () => {
	it.each([
		['bare kings', '4k3/8/8/8/8/8/8/4K3 w - - 0 1'],
		['a lone knight', '4k3/8/8/8/8/8/8/4KN2 w - - 0 1'],
		['bishops of both sides on dark squares', '4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1'],
		['two bishops of one side on dark squares', '4k3/8/8/8/8/8/8/B1B1K3 w - - 0 1'],
	])('calls a position with %s dead', (_case, fen) => {
		expect(ChessMoveGenerator.status(ChessFen.parse(fen), [])).toBe('draw');
	});

	it.each([
		['bishops on opposite colours', '4k1b1/8/8/8/8/8/8/2B1K3 w - - 0 1'],
		['two knights, which can mate with help', '4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1'],
	])('keeps playing with %s', (_case, fen) => {
		expect(ChessMoveGenerator.status(ChessFen.parse(fen), [])).toBe('playing');
	});

	/**
	 * `e4` records an en passant target no black pawn can answer, so by the rule it leaves the
	 * same position the knight shuffle keeps returning to.
	 */
	it('counts a position whose en passant target nobody could have used', () => {
		const line = ['e4', 'Nf6', 'Nf3', 'Ng8', 'Ng1', 'Nf6', 'Nf3', 'Ng8', 'Ng1'];
		const third = replay(line);

		expect(ChessMoveGenerator.status(third.position, third.history)).toBe('draw');
	});

	it('draws only on the third occurrence of a position', () => {
		const shuffle = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'];
		const second = replay(shuffle.slice(0, 4));
		const third = replay(shuffle);

		// The starting position is back on the board — counters aside, which is the
		// point of comparing keys — but it has only been here twice.
		expect(ChessFen.positionKey(second.position)).toBe(ChessFen.positionKey(ChessFen.initial()));
		expect(second.position.halfmoveClock).toBe(4);
		expect(ChessMoveGenerator.status(second.position, second.history)).toBe('playing');

		expect(ChessMoveGenerator.status(third.position, third.history)).toBe('draw');
	});
});

describe('squares', () => {
	it('refuses to index a square off the board', () => {
		expect(() => ChessSquare.toIndex('z3' as Square)).toThrow(RangeError);
		expect(() => ChessSquare.toIndex('a9' as Square)).toThrow(RangeError);
		expect(ChessSquare.toIndex('h4')).toBe(39);
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
		expect(ChessMoveGenerator.status(ChessFen.parse('7k/5QK1/8/8/8/8/8/8 b - - 0 1'), [])).toBe(
			'checkmate',
		);
		expect(ChessMoveGenerator.status(ChessFen.parse('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), [])).toBe(
			'stalemate',
		);
	});

	it('refuses an ambiguous or illegal move', () => {
		const position = ChessFen.parse('r3k2r/1P6/8/3N1N2/8/8/8/4K3 w kq - 0 1');

		expect(ChessNotation.parse(position, 'Ne7')).toBeUndefined();
		expect(ChessNotation.parse(position, 'e4')).toBeUndefined();
	});
});

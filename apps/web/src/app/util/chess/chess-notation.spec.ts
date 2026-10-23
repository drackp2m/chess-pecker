import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChessMove, ChessPosition } from '@app/definition/chess.type';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessNotation } from '@app/util/chess/chess-notation';

function requireMove(position: ChessPosition, notation: string): ChessMove {
	const move = ChessNotation.parse(position, notation);

	if (undefined === move) {
		throw new Error(`"${notation}" should be legal in ${ChessFen.serialize(position)}`);
	}

	return move;
}

function describeMove(fen: string, notation: string): string {
	const position = ChessFen.parse(fen);

	return ChessNotation.describe(position, requireMove(position, notation));
}

function boardCopiesToDescribe(fen: string, notation: string): number {
	const position = ChessFen.parse(fen);
	const move = requireMove(position, notation);
	const apply = vi.spyOn(ChessBoard, 'apply');

	ChessNotation.describe(position, move);

	return apply.mock.calls.length;
}

describe('ChessNotation.describe', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('does not name the origin when the only rival is pinned', () => {
		expect(describeMove('4k3/8/8/8/1b6/2N5/8/4K1N1 w - - 0 1', 'g1e2')).toBe('Ne2');
	});

	it('names the rank when the rivals share the file', () => {
		const fen = '4k3/8/8/R7/8/8/8/R3K3 w - - 0 1';

		expect(describeMove(fen, 'a1a3')).toBe('R1a3');
		expect(describeMove(fen, 'a5a3')).toBe('R5a3');
	});

	it('copies the board only for the move itself when no other piece could have made it', () => {
		expect(boardCopiesToDescribe(ChessFen.serialize(ChessFen.initial()), 'g1f3')).toBe(1);
	});

	it('stops at the first legal reply when it checks whether a check is mate', () => {
		const fen = '7k/8/8/4N3/8/8/8/K7 w - - 0 1';

		expect(describeMove(fen, 'Nf7')).toBe('Nf7+');
		expect(boardCopiesToDescribe(fen, 'Nf7')).toBe(2);
	});
});

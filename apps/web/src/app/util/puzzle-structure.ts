import { ChessPosition, PieceType } from '@app/definition/chess.type';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessNotation } from '@app/util/chess/chess-notation';

export interface PuzzleStructure {
	readonly playerMoves: number;
	readonly isQuietStart: boolean;
	readonly material: number;
}

export interface PuzzleLine {
	readonly fen: string;
	readonly moves: readonly string[];
}

const NOT_MATERIAL: readonly PieceType[] = ['pawn', 'king'];

export function puzzleStructure(line: PuzzleLine | undefined): PuzzleStructure {
	const playerMoves = Math.floor((line?.moves.length ?? 0) / 2);

	if (undefined === line) {
		return { playerMoves, isQuietStart: false, material: 0 };
	}

	try {
		const start = ChessFen.parse(line.fen);

		return {
			playerMoves,
			isQuietStart: isQuietStart(start, line.moves),
			material: countMaterial(start),
		};
	} catch {
		return { playerMoves, isQuietStart: false, material: 0 };
	}
}

function isQuietStart(start: ChessPosition, moves: readonly string[]): boolean {
	const opening = play(start, moves[0]);
	const reply = undefined === opening ? undefined : ChessNotation.parse(opening, moves[1] ?? '');

	if (undefined === opening || undefined === reply) {
		return false;
	}

	const after = ChessBoard.apply(opening, reply);

	return (
		undefined === reply.captured &&
		undefined === reply.promotion &&
		!ChessMoveGenerator.isInCheck(after, after.turn)
	);
}

function play(position: ChessPosition, uci: string | undefined): ChessPosition | undefined {
	const move = undefined === uci ? undefined : ChessNotation.parse(position, uci);

	return undefined === move ? undefined : ChessBoard.apply(position, move);
}

function countMaterial(position: ChessPosition): number {
	return position.board.filter((piece) => undefined !== piece && !NOT_MATERIAL.includes(piece.type))
		.length;
}

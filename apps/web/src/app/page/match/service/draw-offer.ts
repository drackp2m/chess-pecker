import { PIECE_VALUE } from '@app/definition/chess.constant';
import { ChessPosition, PieceColor } from '@app/definition/chess.type';

const EVEN_DRAW_MIN_PLIES = 60;

export function acceptsDraw(position: ChessPosition, machine: PieceColor, plies: number): boolean {
	const balance = materialOf(position, machine) - materialOf(position, opposite(machine));

	return 0 > balance || (0 === balance && EVEN_DRAW_MIN_PLIES <= plies);
}

function materialOf(position: ChessPosition, color: PieceColor): number {
	return position.board.reduce(
		(total, piece) => total + (color === piece?.color ? PIECE_VALUE[piece.type] : 0),
		0,
	);
}

function opposite(color: PieceColor): PieceColor {
	return 'white' === color ? 'black' : 'white';
}

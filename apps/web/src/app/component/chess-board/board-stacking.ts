import { Piece, PieceColor, PieceType } from '@app/definition/chess.type';

/** Weakest to strongest, which is the order they are stacked in. */
const BY_FORCE: readonly PieceType[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

/** The tie between two pieces of equal force, and the only one there is to break. */
const BY_COLOR: readonly PieceColor[] = ['black', 'white'];

/** How many levels the board hands out, so anything drawn over it can clear them. */
export const PIECE_ELEVATIONS = BY_FORCE.length * BY_COLOR.length;

/**
 * Which piece is drawn over which while two share a square. Force decides and colour settles
 * the tie; two that would need more than that cannot meet on a square at all.
 */
export function pieceElevation(piece: Piece): number {
	return BY_FORCE.indexOf(piece.type) * BY_COLOR.length + BY_COLOR.indexOf(piece.color) + 1;
}

export const MOVING_ELEVATION = PIECE_ELEVATIONS + 1;

export function squareElevation(piece: Piece | undefined, isMoving: boolean): number | undefined {
	if (undefined === piece) {
		return undefined;
	}

	return isMoving ? MOVING_ELEVATION : pieceElevation(piece);
}

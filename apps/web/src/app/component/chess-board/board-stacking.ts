import { Piece, PieceColor, PieceType } from '@app/definition/chess.type';

/** Weakest to strongest, which is the order they are stacked in. */
const BY_FORCE: readonly PieceType[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

/** The tie between two pieces of equal force, and the only one there is to break. */
const BY_COLOR: readonly PieceColor[] = ['black', 'white'];

/** How many levels the board hands out, so anything drawn over it can clear them. */
export const PIECE_ELEVATIONS = BY_FORCE.length * BY_COLOR.length;

/**
 * Which piece is drawn over which when two of them share a square, as they do for as
 * long as one is travelling. Force decides it and colour settles the tie, so the white
 * king rides over everything and the black pawn goes under it — and two pieces that
 * would need any more than that, being the same force and the same colour, cannot meet
 * on a square in the first place.
 */
export function pieceElevation(piece: Piece): number {
	return BY_FORCE.indexOf(piece.type) * BY_COLOR.length + BY_COLOR.indexOf(piece.color) + 1;
}

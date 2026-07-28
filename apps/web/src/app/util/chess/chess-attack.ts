import {
	DIAGONAL_VECTORS,
	KNIGHT_VECTORS,
	QUEEN_VECTORS,
	STRAIGHT_VECTORS,
} from '@app/definition/chess.constant';
import { Piece, PieceColor } from '@app/definition/chess.type';
import { ChessSquare } from '@app/util/chess/chess-square';

type Board = readonly (Piece | undefined)[];

/** Answers "is this square under fire?", the primitive every legality check builds on. */
export abstract class ChessAttack {
	static isSquareAttacked(board: Board, index: number, byColor: PieceColor): boolean {
		return (
			this.isAttackedByPawn(board, index, byColor) ||
			this.isAttackedByStep(board, index, byColor, KNIGHT_VECTORS, 'knight') ||
			this.isAttackedByStep(board, index, byColor, QUEEN_VECTORS, 'king') ||
			this.isAttackedByRide(board, index, byColor, STRAIGHT_VECTORS, 'rook') ||
			this.isAttackedByRide(board, index, byColor, DIAGONAL_VECTORS, 'bishop')
		);
	}

	static findKing(board: Board, color: PieceColor): number | undefined {
		const index = board.findIndex((piece) => 'king' === piece?.type && color === piece.color);

		return -1 === index ? undefined : index;
	}

	static isKingAttacked(board: Board, color: PieceColor): boolean {
		const king = this.findKing(board, color);

		if (undefined === king) {
			return false;
		}

		return this.isSquareAttacked(board, king, 'white' === color ? 'black' : 'white');
	}

	/** Pawns capture diagonally forward, so we look backwards from the target square. */
	private static isAttackedByPawn(board: Board, index: number, byColor: PieceColor): boolean {
		const rowDelta = -ChessSquare.pawnDirection(byColor);

		return [-1, 1].some((fileDelta) => {
			const origin = ChessSquare.offset(index, fileDelta, rowDelta);

			if (undefined === origin) {
				return false;
			}

			const piece = board[origin];

			return 'pawn' === piece?.type && byColor === piece.color;
		});
	}

	private static isAttackedByStep(
		board: Board,
		index: number,
		byColor: PieceColor,
		vectors: readonly (readonly [number, number])[],
		type: 'knight' | 'king',
	): boolean {
		return vectors.some(([fileDelta, rowDelta]) => {
			const origin = ChessSquare.offset(index, fileDelta, rowDelta);

			if (undefined === origin) {
				return false;
			}

			const piece = board[origin];

			return type === piece?.type && byColor === piece.color;
		});
	}

	private static isAttackedByRide(
		board: Board,
		index: number,
		byColor: PieceColor,
		vectors: readonly (readonly [number, number])[],
		type: 'rook' | 'bishop',
	): boolean {
		return vectors.some(([fileDelta, rowDelta]) => {
			let origin = ChessSquare.offset(index, fileDelta, rowDelta);

			while (undefined !== origin) {
				const piece = board[origin];

				if (undefined !== piece) {
					return byColor === piece.color && (type === piece.type || 'queen' === piece.type);
				}

				origin = ChessSquare.offset(origin, fileDelta, rowDelta);
			}

			return false;
		});
	}
}

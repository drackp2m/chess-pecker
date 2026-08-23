import { BOARD_SIZE } from '@app/definition/chess.constant';
import { CastlingSide, ChessMove, ChessPosition, Piece } from '@app/definition/chess.type';
import { ChessAttack } from '@app/util/chess/chess-attack';
import { ChessSquare } from '@app/util/chess/chess-square';

/** The board indexes the rook travels between while the king castles. */
export interface CastlingRookMove {
	readonly from: number;
	readonly to: number;
}

/**
 * Castling lives apart from the generator, having more preconditions than any other move:
 * the right, a clear path, and a king neither in check nor crossing an attacked square.
 */
export abstract class ChessCastling {
	static moves(position: ChessPosition, index: number, king: Piece): ChessMove[] {
		const home = 'white' === king.color ? ChessSquare.toIndex('e1') : ChessSquare.toIndex('e8');

		if (index !== home || ChessAttack.isKingAttacked(position.board, king.color)) {
			return [];
		}

		const sides: CastlingSide[] = [];

		if (this.hasRight(position, king, 'king')) {
			sides.push('king');
		}

		if (this.hasRight(position, king, 'queen')) {
			sides.push('queen');
		}

		return sides
			.filter((side) => this.isPathUsable(position, index, king, side))
			.map((side) => this.build(index, king, side));
	}

	/**
	 * The rook's half, read off the square the king reached. Both the board and the animation
	 * need it, which is why neither owns the arithmetic.
	 */
	static rookMove(kingTo: number, side: CastlingSide): CastlingRookMove {
		const row = ChessSquare.rowOf(kingTo) * BOARD_SIZE;

		return { from: row + ('king' === side ? 7 : 0), to: row + ('king' === side ? 5 : 3) };
	}

	private static hasRight(position: ChessPosition, king: Piece, side: CastlingSide): boolean {
		const { castling } = position;

		if ('white' === king.color) {
			return 'king' === side ? castling.whiteKing : castling.whiteQueen;
		}

		return 'king' === side ? castling.blackKing : castling.blackQueen;
	}

	/** Squares between king and rook must be empty; the king's route must be safe. */
	private static isPathUsable(
		position: ChessPosition,
		index: number,
		king: Piece,
		side: CastlingSide,
	): boolean {
		const row = ChessSquare.rowOf(index);
		const emptyFiles = 'king' === side ? [5, 6] : [1, 2, 3];
		const safeFiles = 'king' === side ? [5, 6] : [2, 3];
		const opponent = 'white' === king.color ? 'black' : 'white';

		const isClear = emptyFiles.every(
			(file) => undefined === position.board[row * BOARD_SIZE + file],
		);

		if (!isClear) {
			return false;
		}

		return safeFiles.every(
			(file) => !ChessAttack.isSquareAttacked(position.board, row * BOARD_SIZE + file, opponent),
		);
	}

	private static build(index: number, king: Piece, side: CastlingSide): ChessMove {
		const row = ChessSquare.rowOf(index);
		const to = row * BOARD_SIZE + ('king' === side ? 6 : 2);

		return {
			from: ChessSquare.fromIndex(index),
			to: ChessSquare.fromIndex(to),
			piece: 'king',
			color: king.color,
			captured: undefined,
			promotion: undefined,
			castling: side,
			isEnPassant: false,
		};
	}
}

import { BOARD_SIZE } from '@app/definition/chess.constant';
import {
	CastlingRights,
	CastlingSide,
	ChessMove,
	ChessPosition,
	Piece,
	Square,
} from '@app/definition/chess.type';
import { ChessCastling } from '@app/util/chess/chess-castling';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessSquare } from '@app/util/chess/chess-square';

/** A piece together with the square it stands on. */
interface PlacedPiece {
	readonly piece: Piece;
	readonly index: number;
}

/** Applies moves to a position. Every result is a brand new immutable snapshot. */
export abstract class ChessBoard {
	static apply(position: ChessPosition, move: ChessMove): ChessPosition {
		const board = [...position.board];
		const from = ChessSquare.toIndex(move.from);
		const to = ChessSquare.toIndex(move.to);

		board[from] = undefined;
		board[to] = {
			type: move.promotion ?? move.piece,
			color: move.color,
		};

		if (move.isEnPassant) {
			board[to - ChessSquare.pawnDirection(move.color) * BOARD_SIZE] = undefined;
		}

		if (undefined !== move.castling) {
			this.moveCastlingRook(board, to, move.castling);
		}

		return {
			board,
			turn: 'white' === move.color ? 'black' : 'white',
			castling: this.updateCastlingRights(position.castling, from, to),
			enPassant: this.getEnPassantTarget(move, from, to),
			halfmoveClock:
				'pawn' === move.piece || undefined !== move.captured ? 0 : position.halfmoveClock + 1,
			fullmoveNumber:
				'black' === move.color ? position.fullmoveNumber + 1 : position.fullmoveNumber,
		};
	}

	static pieceAt(position: ChessPosition, square: Square): Piece | undefined {
		return position.board[ChessSquare.toIndex(square)];
	}

	/**
	 * Positions no legal sequence can mate from: bare kings, a single minor piece, or bishops
	 * all on one colour. Two knights are deliberately absent, being unforceable but possible.
	 */
	static hasInsufficientMaterial(position: ChessPosition): boolean {
		const rest = this.placed(position).filter(({ piece }) => 'king' !== piece.type);

		if (1 >= rest.length) {
			return rest.every(({ piece }) => 'bishop' === piece.type || 'knight' === piece.type);
		}

		return this.areBishopsOnOneColor(rest);
	}

	/**
	 * Three occurrences of the same position, as `ChessFen.positionKey` defines it. `history`
	 * holds what came before this one, so two matches in it make this the third.
	 */
	static isThreefoldRepetition(
		position: ChessPosition,
		history: readonly ChessPosition[],
	): boolean {
		const key = ChessFen.positionKey(position);

		return 2 <= history.filter((past) => ChessFen.positionKey(past) === key).length;
	}

	/** The occupied squares, keeping the index each piece sits on. */
	private static placed(position: ChessPosition): PlacedPiece[] {
		const placed: PlacedPiece[] = [];

		position.board.forEach((piece, index) => {
			if (undefined !== piece) {
				placed.push({ piece, index });
			}
		});

		return placed;
	}

	private static areBishopsOnOneColor(pieces: readonly PlacedPiece[]): boolean {
		if (!pieces.every(({ piece }) => 'bishop' === piece.type)) {
			return false;
		}

		const colors = new Set(pieces.map(({ index }) => ChessSquare.isLight(index)));

		return 1 === colors.size;
	}

	private static moveCastlingRook(
		board: (Piece | undefined)[],
		kingTo: number,
		side: CastlingSide,
	): void {
		const rook = ChessCastling.rookMove(kingTo, side);

		board[rook.to] = board[rook.from];
		board[rook.from] = undefined;
	}

	/** A right disappears as soon as its king or rook leaves — or its rook is captured. */
	private static updateCastlingRights(
		castling: CastlingRights,
		from: number,
		to: number,
	): CastlingRights {
		const touched = [from, to];
		const whiteKingMoved = touched.includes(ChessSquare.toIndex('e1'));
		const blackKingMoved = touched.includes(ChessSquare.toIndex('e8'));

		return {
			whiteKing:
				castling.whiteKing && !whiteKingMoved && !touched.includes(ChessSquare.toIndex('h1')),
			whiteQueen:
				castling.whiteQueen && !whiteKingMoved && !touched.includes(ChessSquare.toIndex('a1')),
			blackKing:
				castling.blackKing && !blackKingMoved && !touched.includes(ChessSquare.toIndex('h8')),
			blackQueen:
				castling.blackQueen && !blackKingMoved && !touched.includes(ChessSquare.toIndex('a8')),
		};
	}

	/** Only a double pawn push leaves a square open to en passant capture. */
	private static getEnPassantTarget(move: ChessMove, from: number, to: number): Square | undefined {
		const isDoublePush =
			'pawn' === move.piece && 2 === Math.abs(ChessSquare.rowOf(from) - ChessSquare.rowOf(to));

		if (!isDoublePush) {
			return undefined;
		}

		return ChessSquare.fromIndex((from + to) / 2);
	}
}

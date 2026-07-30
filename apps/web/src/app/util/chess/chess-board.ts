import { BOARD_SIZE } from '@app/definition/chess.constant';
import {
	CastlingRights,
	ChessMove,
	ChessPosition,
	Piece,
	Square,
} from '@app/definition/chess.type';
import { ChessSquare } from '@app/util/chess/chess-square';

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

	/** King versus king (plus at most one minor piece) can never be mated. */
	// ToDo => misses king+bishop vs king+bishop on same-coloured squares, the one
	// four-piece case that is also dead. Only affects the free-play match, and the
	// match has no threefold-repetition check either — `positionHistory` already holds
	// what that would need.
	static hasInsufficientMaterial(position: ChessPosition): boolean {
		const pieces = position.board.filter((piece): piece is Piece => undefined !== piece);

		if (2 === pieces.length) {
			return true;
		}

		if (3 !== pieces.length) {
			return false;
		}

		return pieces.some((piece) => 'knight' === piece.type || 'bishop' === piece.type);
	}

	private static moveCastlingRook(
		board: (Piece | undefined)[],
		kingTo: number,
		side: 'king' | 'queen',
	): void {
		const row = ChessSquare.rowOf(kingTo);
		const rookFrom = row * BOARD_SIZE + ('king' === side ? 7 : 0);
		const rookTo = row * BOARD_SIZE + ('king' === side ? 5 : 3);

		board[rookTo] = board[rookFrom];
		board[rookFrom] = undefined;
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

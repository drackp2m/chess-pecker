import {
	DIAGONAL_VECTORS,
	KNIGHT_VECTORS,
	PROMOTION_PIECES,
	QUEEN_VECTORS,
	STRAIGHT_VECTORS,
} from '@app/definition/chess.constant';
import {
	ChessMove,
	ChessPosition,
	MatchStatus,
	Piece,
	PieceColor,
	Square,
} from '@app/definition/chess.type';
import { ChessAttack } from '@app/util/chess/chess-attack';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessCastling } from '@app/util/chess/chess-castling';
import { ChessSquare } from '@app/util/chess/chess-square';

type Vectors = readonly (readonly [number, number])[];

/** Generates the moves a side may actually play, castling and en passant included. */
export abstract class ChessMoveGenerator {
	static legalMoves(position: ChessPosition): ChessMove[] {
		return this.pseudoLegalMoves(position).filter(
			(move) => !this.leavesKingExposed(position, move),
		);
	}

	static movesFrom(position: ChessPosition, index: number): ChessMove[] {
		const from = ChessSquare.fromIndex(index);

		return this.legalMoves(position).filter((move) => move.from === from);
	}

	static isInCheck(position: ChessPosition, color: PieceColor): boolean {
		return ChessAttack.isKingAttacked(position.board, color);
	}

	/** Square of the king that is currently in check, for the board to highlight. */
	static checkedSquare(position: ChessPosition): Square | undefined {
		if (!this.isInCheck(position, position.turn)) {
			return undefined;
		}

		const king = ChessAttack.findKing(position.board, position.turn);

		return undefined === king ? undefined : ChessSquare.fromIndex(king);
	}

	/**
	 * `history` is what the game passed through before this position, which only the
	 * repetition rule needs. It has no default on purpose: an empty one is a fine
	 * answer — a puzzle asking whether a move mates has no game behind it — but it has
	 * to be written down, because a caller that has a history and forgets to pass it
	 * gets no error, just a game where repetitions never draw.
	 */
	static status(position: ChessPosition, history: readonly ChessPosition[]): MatchStatus {
		if (0 === this.legalMoves(position).length) {
			return this.isInCheck(position, position.turn) ? 'checkmate' : 'stalemate';
		}

		const isDrawn =
			ChessBoard.hasInsufficientMaterial(position) ||
			100 <= position.halfmoveClock ||
			ChessBoard.isThreefoldRepetition(position, history);

		return isDrawn ? 'draw' : 'playing';
	}

	static pseudoLegalMoves(position: ChessPosition): ChessMove[] {
		const moves: ChessMove[] = [];

		position.board.forEach((piece, index) => {
			if (piece?.color !== position.turn) {
				return;
			}

			moves.push(...this.movesForPiece(position, index, piece));
		});

		return moves;
	}

	private static movesForPiece(position: ChessPosition, index: number, piece: Piece): ChessMove[] {
		switch (piece.type) {
			case 'pawn':
				return this.pawnMoves(position, index, piece);
			case 'knight':
				return this.stepMoves(position, index, piece, KNIGHT_VECTORS);
			case 'bishop':
				return this.rideMoves(position, index, piece, DIAGONAL_VECTORS);
			case 'rook':
				return this.rideMoves(position, index, piece, STRAIGHT_VECTORS);
			case 'queen':
				return this.rideMoves(position, index, piece, QUEEN_VECTORS);
			case 'king':
				return [
					...this.stepMoves(position, index, piece, QUEEN_VECTORS),
					...ChessCastling.moves(position, index, piece),
				];
		}
	}

	private static pawnMoves(position: ChessPosition, index: number, piece: Piece): ChessMove[] {
		const direction = ChessSquare.pawnDirection(piece.color);
		const moves: ChessMove[] = [];
		const single = ChessSquare.offset(index, 0, direction);

		if (undefined !== single && undefined === position.board[single]) {
			moves.push(...this.expandPromotions(this.build(index, single, piece, undefined)));

			const double = ChessSquare.offset(index, 0, 2 * direction);
			const isOnStartRow = ChessSquare.rowOf(index) === ChessSquare.pawnStartRow(piece.color);

			if (isOnStartRow && undefined !== double && undefined === position.board[double]) {
				moves.push(this.build(index, double, piece, undefined));
			}
		}

		moves.push(...this.pawnCaptures(position, index, piece));

		return moves;
	}

	private static pawnCaptures(position: ChessPosition, index: number, piece: Piece): ChessMove[] {
		const direction = ChessSquare.pawnDirection(piece.color);
		const moves: ChessMove[] = [];

		for (const fileDelta of [-1, 1]) {
			const target = ChessSquare.offset(index, fileDelta, direction);

			if (undefined === target) {
				continue;
			}

			const occupant = position.board[target];
			const isEnPassant =
				undefined !== position.enPassant &&
				ChessSquare.toIndex(position.enPassant) === target &&
				undefined === occupant;

			if (undefined !== occupant && occupant.color !== piece.color) {
				moves.push(...this.expandPromotions(this.build(index, target, piece, occupant.type)));
			} else if (isEnPassant) {
				moves.push({ ...this.build(index, target, piece, 'pawn'), isEnPassant: true });
			}
		}

		return moves;
	}

	private static stepMoves(
		position: ChessPosition,
		index: number,
		piece: Piece,
		vectors: Vectors,
	): ChessMove[] {
		const moves: ChessMove[] = [];

		for (const [fileDelta, rowDelta] of vectors) {
			const target = ChessSquare.offset(index, fileDelta, rowDelta);

			if (undefined === target) {
				continue;
			}

			const occupant = position.board[target];

			if (undefined === occupant) {
				moves.push(this.build(index, target, piece, undefined));
			} else if (occupant.color !== piece.color) {
				moves.push(this.build(index, target, piece, occupant.type));
			}
		}

		return moves;
	}

	private static rideMoves(
		position: ChessPosition,
		index: number,
		piece: Piece,
		vectors: Vectors,
	): ChessMove[] {
		const moves: ChessMove[] = [];

		for (const [fileDelta, rowDelta] of vectors) {
			let target = ChessSquare.offset(index, fileDelta, rowDelta);

			while (undefined !== target) {
				const occupant = position.board[target];

				if (undefined === occupant) {
					moves.push(this.build(index, target, piece, undefined));
					target = ChessSquare.offset(target, fileDelta, rowDelta);

					continue;
				}

				if (occupant.color !== piece.color) {
					moves.push(this.build(index, target, piece, occupant.type));
				}

				break;
			}
		}

		return moves;
	}

	/** A pawn reaching the last rank becomes four distinct moves, one per piece. */
	private static expandPromotions(move: ChessMove): ChessMove[] {
		const isPromotion =
			'pawn' === move.piece &&
			ChessSquare.rowOf(ChessSquare.toIndex(move.to)) === ChessSquare.promotionRow(move.color);

		if (!isPromotion) {
			return [move];
		}

		return PROMOTION_PIECES.map((promotion) => ({ ...move, promotion }));
	}

	private static build(
		from: number,
		to: number,
		piece: Piece,
		captured: ChessMove['captured'],
	): ChessMove {
		return {
			from: ChessSquare.fromIndex(from),
			to: ChessSquare.fromIndex(to),
			piece: piece.type,
			color: piece.color,
			captured,
			promotion: undefined,
			castling: undefined,
			isEnPassant: false,
		};
	}

	private static leavesKingExposed(position: ChessPosition, move: ChessMove): boolean {
		return ChessAttack.isKingAttacked(ChessBoard.apply(position, move).board, move.color);
	}
}

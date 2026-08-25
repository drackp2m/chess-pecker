import { PIECE_BY_LETTER, PIECE_LETTER } from '@app/definition/chess.constant';
import {
	ChessMove,
	ChessPosition,
	PieceType,
	PromotionPieceType,
	Square,
} from '@app/definition/chess.type';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';

const SAN_PATTERN = /^([KQRBN])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([QRBN]))?$/;
const LONG_PATTERN = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

/**
 * Standard Algebraic Notation both ways: `describe` renders a played move, `describeLong`
 * the position-free UCI form, and `parse` turns either back into a concrete move.
 */
export abstract class ChessNotation {
	/** Full SAN for a move about to be played from `position`, suffix included. */
	// ToDo => one `describe` runs the move generator three times, each legality-checking
	// against a copied board. Threading a precomputed `legalMoves` through removes two.
	static describe(position: ChessPosition, move: ChessMove): string {
		return this.describeBody(position, move) + this.suffix(position, move);
	}

	/**
	 * The long algebraic (UCI) form of a move: origin, target, and the piece a promotion
	 * picked. It needs no position, which is what makes it the shape a record is kept in.
	 */
	static describeLong(move: ChessMove): string {
		const promotion =
			undefined === move.promotion ? '' : PIECE_LETTER[move.promotion].toLowerCase();

		return move.from + move.to + promotion;
	}

	/** Resolves written notation against the legal moves of `position`. */
	static parse(position: ChessPosition, notation: string): ChessMove | undefined {
		const cleaned = notation
			.trim()
			.replace(/[+#!?]/g, '')
			.replace(/[\s.]/g, '');
		const legalMoves = ChessMoveGenerator.legalMoves(position);
		const castling = this.parseCastling(cleaned);

		if (undefined !== castling) {
			return legalMoves.find((move) => castling === move.castling);
		}

		const long = LONG_PATTERN.exec(cleaned);

		if (null !== long) {
			return this.matchLong(legalMoves, long);
		}

		const san = SAN_PATTERN.exec(cleaned);

		return null === san ? undefined : this.matchSan(legalMoves, san);
	}

	private static describeBody(position: ChessPosition, move: ChessMove): string {
		if ('king' === move.castling) {
			return 'O-O';
		}

		if ('queen' === move.castling) {
			return 'O-O-O';
		}

		const isCapture = undefined !== move.captured;
		const origin = this.origin(position, move, isCapture);
		const promotion = undefined === move.promotion ? '' : `=${PIECE_LETTER[move.promotion]}`;

		return PIECE_LETTER[move.piece] + origin + (isCapture ? 'x' : '') + move.to + promotion;
	}

	/** A capturing pawn is named by its file; other pieces only when ambiguous. */
	private static origin(position: ChessPosition, move: ChessMove, isCapture: boolean): string {
		if ('pawn' !== move.piece) {
			return this.disambiguate(position, move);
		}

		return isCapture ? move.from.charAt(0) : '';
	}

	/** Adds only as much of the origin square as is needed to stay unambiguous. */
	private static disambiguate(position: ChessPosition, move: ChessMove): string {
		const rivals = ChessMoveGenerator.legalMoves(position).filter(
			(candidate) =>
				candidate.piece === move.piece && candidate.to === move.to && candidate.from !== move.from,
		);

		if (0 === rivals.length) {
			return '';
		}

		const file = move.from.charAt(0);
		const rank = move.from.charAt(1);

		if (!rivals.some((rival) => rival.from.startsWith(file))) {
			return file;
		}

		if (!rivals.some((rival) => rival.from.endsWith(rank))) {
			return rank;
		}

		return move.from;
	}

	private static suffix(position: ChessPosition, move: ChessMove): string {
		const next = ChessBoard.apply(position, move);

		if (!ChessMoveGenerator.isInCheck(next, next.turn)) {
			return '';
		}

		return 0 === ChessMoveGenerator.legalMoves(next).length ? '#' : '+';
	}

	private static parseCastling(notation: string): 'king' | 'queen' | undefined {
		const normalized = notation.toUpperCase().replace(/0/g, 'O');

		if ('O-O-O' === normalized) {
			return 'queen';
		}

		return 'O-O' === normalized ? 'king' : undefined;
	}

	private static matchLong(
		legalMoves: readonly ChessMove[],
		match: RegExpExecArray,
	): ChessMove | undefined {
		const [, from, to, promotion] = match;
		const promoted = undefined === promotion ? undefined : PIECE_BY_LETTER[promotion.toLowerCase()];

		return legalMoves.find(
			(move) =>
				move.from === (from as Square) &&
				move.to === (to as Square) &&
				move.promotion === (promoted as PromotionPieceType | undefined),
		);
	}

	private static matchSan(
		legalMoves: readonly ChessMove[],
		match: RegExpExecArray,
	): ChessMove | undefined {
		const [, letter, fromFile, fromRank, to, promotion] = match;
		const piece: PieceType =
			undefined === letter ? 'pawn' : (PIECE_BY_LETTER[letter.toLowerCase()] ?? 'pawn');
		const promoted = undefined === promotion ? undefined : PIECE_BY_LETTER[promotion.toLowerCase()];

		const candidates = legalMoves.filter(
			(move) =>
				move.piece === piece &&
				move.to === (to as Square) &&
				move.promotion === (promoted as PromotionPieceType | undefined) &&
				(undefined === fromFile || move.from.startsWith(fromFile)) &&
				(undefined === fromRank || move.from.endsWith(fromRank)),
		);

		return 1 === candidates.length ? candidates[0] : undefined;
	}
}

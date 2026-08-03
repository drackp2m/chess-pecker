export type PieceColor = 'white' | 'black';

export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export type PromotionPieceType = Exclude<PieceType, 'king' | 'pawn'>;

export type ChessFile = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';

export type ChessRank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

export type Square = `${ChessFile}${ChessRank}`;

export type CastlingSide = 'king' | 'queen';

// ToDo => `'draw'` swallows three different endings — a dead position, the fifty-move
// rule and threefold repetition — and both boards now print "Drawn position" without
// saying which (`page/match/match.page.ts`, `page/puzzle/puzzle.page.ts`). The reason is
// known where the verdict is reached, in `ChessMoveGenerator.status`, and thrown away on
// the way out. Splitting the member, or returning the reason beside it, is what lets the
// two pages explain themselves; both read this type, so neither needs its own wording.
export type MatchStatus = 'idle' | 'playing' | 'checkmate' | 'stalemate' | 'draw';

export interface Piece {
	readonly type: PieceType;
	readonly color: PieceColor;
}

export interface CastlingRights {
	readonly whiteKing: boolean;
	readonly whiteQueen: boolean;
	readonly blackKing: boolean;
	readonly blackQueen: boolean;
}

/**
 * A single move. Optional traits are modelled as explicit `undefined` unions
 * instead of optional keys because the project enables `exactOptionalPropertyTypes`.
 */
export interface ChessMove {
	readonly from: Square;
	readonly to: Square;
	readonly piece: PieceType;
	readonly color: PieceColor;
	readonly captured: PieceType | undefined;
	readonly promotion: PromotionPieceType | undefined;
	readonly castling: CastlingSide | undefined;
	readonly isEnPassant: boolean;
}

/** A move that has already been played, together with its algebraic notation. */
export interface ChessMoveRecord extends ChessMove {
	readonly san: string;
	readonly fullmoveNumber: number;
}

/** Immutable snapshot of a game: everything a FEN string encodes. */
export interface ChessPosition {
	/** 64 slots, index 0 is `a8` and index 63 is `h1`. */
	readonly board: readonly (Piece | undefined)[];
	readonly turn: PieceColor;
	readonly castling: CastlingRights;
	readonly enPassant: Square | undefined;
	readonly halfmoveClock: number;
	readonly fullmoveNumber: number;
}

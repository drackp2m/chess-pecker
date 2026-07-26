import {
	CastlingRights,
	ChessFile,
	ChessRank,
	PieceType,
	PromotionPieceType,
} from '@app/definition/chess.type';

export const BOARD_SIZE = 8;

export const SQUARE_COUNT = BOARD_SIZE * BOARD_SIZE;

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const FILES: readonly ChessFile[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/** Ranks in board-index order: index 0 is the top row of the array. */
export const RANKS: readonly ChessRank[] = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const PROMOTION_PIECES: readonly PromotionPieceType[] = [
	'queen',
	'rook',
	'bishop',
	'knight',
];

export const NO_CASTLING_RIGHTS: CastlingRights = {
	whiteKing: false,
	whiteQueen: false,
	blackKing: false,
	blackQueen: false,
};

/** Standard algebraic letter of every piece; pawns are written without one. */
export const PIECE_LETTER: Record<PieceType, string> = {
	pawn: '',
	knight: 'N',
	bishop: 'B',
	rook: 'R',
	queen: 'Q',
	king: 'K',
};

export const PIECE_BY_LETTER: Record<string, PieceType> = {
	p: 'pawn',
	n: 'knight',
	b: 'bishop',
	r: 'rook',
	q: 'queen',
	k: 'king',
};

/** Rough material worth, used by the opponent to pick between candidate moves. */
export const PIECE_VALUE: Record<PieceType, number> = {
	pawn: 1,
	knight: 3,
	bishop: 3,
	rook: 5,
	queen: 9,
	king: 0,
};

type Vector = readonly [number, number];

/** `[fileDelta, rowDelta]`, where a positive row delta walks down the board. */
export const DIAGONAL_VECTORS: readonly Vector[] = [
	[1, 1],
	[1, -1],
	[-1, 1],
	[-1, -1],
];

export const STRAIGHT_VECTORS: readonly Vector[] = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
];

export const QUEEN_VECTORS: readonly Vector[] = [...STRAIGHT_VECTORS, ...DIAGONAL_VECTORS];

export const KNIGHT_VECTORS: readonly Vector[] = [
	[1, 2],
	[2, 1],
	[2, -1],
	[1, -2],
	[-1, -2],
	[-2, -1],
	[-2, 1],
	[-1, 2],
];

import { BOARD_SIZE, FILES, RANKS, SQUARE_COUNT } from '@app/definition/chess.constant';
import { ChessFile, ChessRank, PieceColor, Square } from '@app/definition/chess.type';

/**
 * Translates between algebraic squares (`e4`) and board indexes.
 * Index 0 is `a8`, index 63 is `h1`, so a row walks the board downwards.
 */
export abstract class ChessSquare {
	// FixMe => both `indexOf` calls can return -1 and neither is checked, so an
	// off-board string produces a plausible index instead of an error: `"z3"` gives
	// `5 * 8 + -1 = 39`, which is `h4`. The `Square` type makes that unreachable from
	// typed code, but `ChessFen.parse` casts the raw en-passant field of a
	// user-supplied FEN straight to `Square`, and that is exactly how an untrusted
	// string gets here. Its sibling `fromIndex` already throws a `RangeError`.
	static toIndex(square: Square): number {
		const file = FILES.indexOf(square.charAt(0) as ChessFile);
		const row = RANKS.indexOf(square.charAt(1) as ChessRank);

		return row * BOARD_SIZE + file;
	}

	static fromIndex(index: number): Square {
		const file = FILES[this.fileOf(index)];
		const rank = RANKS[this.rowOf(index)];

		if (undefined === file || undefined === rank) {
			throw new RangeError(`Square index out of board: ${index.toString()}`);
		}

		return `${file}${rank}`;
	}

	static fileOf(index: number): number {
		return index % BOARD_SIZE;
	}

	/** Row 0 is rank 8, row 7 is rank 1. */
	static rowOf(index: number): number {
		return Math.floor(index / BOARD_SIZE);
	}

	static rankOf(index: number): number {
		return BOARD_SIZE - this.rowOf(index);
	}

	static isOnBoard(index: number): boolean {
		return 0 <= index && index < SQUARE_COUNT;
	}

	/** Neighbour index, or `undefined` when the offset falls off the board. */
	static offset(index: number, fileDelta: number, rowDelta: number): number | undefined {
		const file = this.fileOf(index) + fileDelta;
		const row = this.rowOf(index) + rowDelta;

		if (0 > file || file >= BOARD_SIZE || 0 > row || row >= BOARD_SIZE) {
			return undefined;
		}

		return row * BOARD_SIZE + file;
	}

	static isLight(index: number): boolean {
		return 0 === (this.fileOf(index) + this.rowOf(index)) % 2;
	}

	/** Row a pawn of the given colour starts from. */
	static pawnStartRow(color: PieceColor): number {
		return 'white' === color ? 6 : 1;
	}

	/** Row a pawn of the given colour promotes on. */
	static promotionRow(color: PieceColor): number {
		return 'white' === color ? 0 : 7;
	}

	/** Row delta of a single pawn push: white walks up the board. */
	static pawnDirection(color: PieceColor): number {
		return 'white' === color ? -1 : 1;
	}
}

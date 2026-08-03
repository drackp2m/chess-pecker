import {
	BOARD_SIZE,
	INITIAL_FEN,
	PIECE_BY_LETTER,
	SQUARE_COUNT,
} from '@app/definition/chess.constant';
import {
	CastlingRights,
	ChessPosition,
	Piece,
	PieceColor,
	Square,
} from '@app/definition/chess.type';
import { ChessAttack } from '@app/util/chess/chess-attack';
import { ChessSquare } from '@app/util/chess/chess-square';

/**
 * Reads and writes Forsyth–Edwards Notation, the format chess exercises ship in.
 *
 * `parse` is strict on purpose: it is the door a pasted CSV comes in through, so
 * every field is either understood or the whole string is rejected. Nothing here
 * returns a half-parsed position.
 */
export abstract class ChessFen {
	static parse(fen: string): ChessPosition {
		const [placement, turn, castling, enPassant, halfmove, fullmove] = fen.trim().split(/\s+/);

		if (undefined === placement || undefined === turn) {
			throw new SyntaxError(`Malformed FEN: ${fen}`);
		}

		return {
			board: this.parsePlacement(placement),
			turn: 'b' === turn ? 'black' : 'white',
			castling: this.parseCastling(castling ?? '-'),
			enPassant: this.parseEnPassant(enPassant ?? '-'),
			halfmoveClock: this.parseCounter(halfmove ?? '0', 'halfmove clock'),
			fullmoveNumber: Math.max(1, this.parseCounter(fullmove ?? '1', 'fullmove number')),
		};
	}

	static initial(): ChessPosition {
		return this.parse(INITIAL_FEN);
	}

	static serialize(position: ChessPosition): string {
		const turn = 'white' === position.turn ? 'w' : 'b';
		const enPassant = position.enPassant ?? '-';

		return [
			this.serializePlacement(position.board),
			turn,
			this.serializeCastling(position.castling),
			enPassant,
			position.halfmoveClock.toString(),
			position.fullmoveNumber.toString(),
		].join(' ');
	}

	/**
	 * Sanity check for a user supplied position: it has to parse, both kings must be
	 * present, and the side that just moved may not be left in check — that position
	 * is unreachable.
	 */
	static isValid(fen: string): boolean {
		try {
			const position = this.parse(fen);
			const kings = position.board.filter((piece) => 'king' === piece?.type);

			if (2 !== kings.length) {
				return false;
			}

			const waiting: PieceColor = 'white' === position.turn ? 'black' : 'white';

			return !ChessAttack.isKingAttacked(position.board, waiting);
		} catch {
			return false;
		}
	}

	/** Eight ranks of eight squares each, or nothing: a short row is not a position. */
	private static parsePlacement(placement: string): readonly (Piece | undefined)[] {
		const rows = placement.split('/');

		if (BOARD_SIZE !== rows.length) {
			throw new SyntaxError(`FEN placement is not eight ranks: ${placement}`);
		}

		const board = new Array<Piece | undefined>(SQUARE_COUNT).fill(undefined);

		rows.forEach((row, index) => {
			this.parsePlacementRow(row, board, index * BOARD_SIZE);
		});

		return board;
	}

	private static parsePlacementRow(
		row: string,
		board: (Piece | undefined)[],
		offset: number,
	): void {
		let file = 0;

		for (const character of row) {
			const skip = Number(character);

			if (!Number.isNaN(skip)) {
				file += skip;

				continue;
			}

			const type = PIECE_BY_LETTER[character.toLowerCase()];

			if (undefined === type || file >= BOARD_SIZE) {
				throw new SyntaxError(`Malformed FEN rank: ${row}`);
			}

			const color: PieceColor = character === character.toUpperCase() ? 'white' : 'black';
			board[offset + file] = { type, color };
			file++;
		}

		if (BOARD_SIZE !== file) {
			throw new SyntaxError(`FEN rank is not eight squares: ${row}`);
		}
	}

	private static parseEnPassant(enPassant: string): Square | undefined {
		if ('-' === enPassant) {
			return undefined;
		}

		if (!ChessSquare.isSquare(enPassant)) {
			throw new SyntaxError(`Malformed FEN en passant square: ${enPassant}`);
		}

		return enPassant;
	}

	/**
	 * A FEN counter is a plain non-negative integer. `Number` would take `"1e3"` and
	 * hand back `NaN` for anything else, which then leaks into the fifty-move rule —
	 * `100 <= NaN` is false, so the draw never fires — and back out through `serialize`.
	 */
	private static parseCounter(counter: string, field: string): number {
		if (!/^\d+$/.test(counter)) {
			throw new SyntaxError(`Malformed FEN ${field}: ${counter}`);
		}

		return Number(counter);
	}

	private static parseCastling(castling: string): CastlingRights {
		return {
			whiteKing: castling.includes('K'),
			whiteQueen: castling.includes('Q'),
			blackKing: castling.includes('k'),
			blackQueen: castling.includes('q'),
		};
	}

	private static serializePlacement(board: readonly (Piece | undefined)[]): string {
		const rows: string[] = [];

		for (let row = 0; row < BOARD_SIZE; row++) {
			let line = '';
			let empty = 0;

			for (let file = 0; file < BOARD_SIZE; file++) {
				const piece = board[row * BOARD_SIZE + file];

				if (undefined === piece) {
					empty++;

					continue;
				}

				line += (0 < empty ? empty.toString() : '') + this.toLetter(piece);
				empty = 0;
			}

			rows.push(line + (0 < empty ? empty.toString() : ''));
		}

		return rows.join('/');
	}

	private static serializeCastling(castling: CastlingRights): string {
		const flags =
			(castling.whiteKing ? 'K' : '') +
			(castling.whiteQueen ? 'Q' : '') +
			(castling.blackKing ? 'k' : '') +
			(castling.blackQueen ? 'q' : '');

		return '' === flags ? '-' : flags;
	}

	private static toLetter(piece: Piece): string {
		const letter =
			Object.entries(PIECE_BY_LETTER).find(([, type]) => type === piece.type)?.[0] ?? 'p';

		return 'white' === piece.color ? letter.toUpperCase() : letter;
	}
}

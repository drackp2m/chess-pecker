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

/** Reads and writes Forsyth–Edwards Notation, the format chess exercises ship in. */
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
			enPassant: undefined === enPassant || '-' === enPassant ? undefined : (enPassant as Square),
			halfmoveClock: Number(halfmove ?? '0'),
			fullmoveNumber: Math.max(1, Number(fullmove ?? '1')),
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
	 * Sanity check for a user supplied position: both kings must be present, and the
	 * side that just moved may not be left in check — that position is unreachable.
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

	private static parsePlacement(placement: string): readonly (Piece | undefined)[] {
		const board = new Array<Piece | undefined>(SQUARE_COUNT).fill(undefined);
		let index = 0;

		for (const character of placement) {
			if ('/' === character) {
				continue;
			}

			const skip = Number(character);

			if (!Number.isNaN(skip)) {
				index += skip;

				continue;
			}

			const type = PIECE_BY_LETTER[character.toLowerCase()];

			if (undefined !== type && index < SQUARE_COUNT) {
				const color: PieceColor = character === character.toUpperCase() ? 'white' : 'black';
				board[index] = { type, color };
			}

			index++;
		}

		return board;
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

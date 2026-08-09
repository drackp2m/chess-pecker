import { PieceColor, PieceType } from '@app/definition/chess.type';
import { I18n } from '@app/i18n';

export const PIECE_LABEL_KEY = {
	white: {
		pawn: I18n.common.PIECE_WHITE_PAWN,
		knight: I18n.common.PIECE_WHITE_KNIGHT,
		bishop: I18n.common.PIECE_WHITE_BISHOP,
		rook: I18n.common.PIECE_WHITE_ROOK,
		queen: I18n.common.PIECE_WHITE_QUEEN,
		king: I18n.common.PIECE_WHITE_KING,
	},
	black: {
		pawn: I18n.common.PIECE_BLACK_PAWN,
		knight: I18n.common.PIECE_BLACK_KNIGHT,
		bishop: I18n.common.PIECE_BLACK_BISHOP,
		rook: I18n.common.PIECE_BLACK_ROOK,
		queen: I18n.common.PIECE_BLACK_QUEEN,
		king: I18n.common.PIECE_BLACK_KING,
	},
} as const satisfies Record<PieceColor, Record<PieceType, string>>;

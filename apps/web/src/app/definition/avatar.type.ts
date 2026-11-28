import type { AvatarColor, AvatarPiece } from '@chesspecker/api-definitions';

import { I18n } from '@app/i18n';

export const AVATAR_PIECE_LABEL = {
	pawn: I18n.profile.PIECE_PAWN,
	knight: I18n.profile.PIECE_KNIGHT,
	bishop: I18n.profile.PIECE_BISHOP,
	rook: I18n.profile.PIECE_ROOK,
	queen: I18n.profile.PIECE_QUEEN,
	king: I18n.profile.PIECE_KING,
} as const satisfies Record<AvatarPiece, string>;

export const AVATAR_COLOR_LABEL = {
	red: I18n.profile.COLOR_RED,
	orange: I18n.profile.COLOR_ORANGE,
	yellow: I18n.profile.COLOR_YELLOW,
	lime: I18n.profile.COLOR_LIME,
	green: I18n.profile.COLOR_GREEN,
	teal: I18n.profile.COLOR_TEAL,
	sky: I18n.profile.COLOR_SKY,
	blue: I18n.profile.COLOR_BLUE,
	violet: I18n.profile.COLOR_VIOLET,
	pink: I18n.profile.COLOR_PINK,
	brown: I18n.profile.COLOR_BROWN,
	slate: I18n.profile.COLOR_SLATE,
	ivory: I18n.profile.COLOR_IVORY,
	ink: I18n.profile.COLOR_INK,
} as const satisfies Record<AvatarColor, string>;

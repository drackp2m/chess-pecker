import { z } from 'zod';

export const AVATAR_PIECES = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'] as const;

export type AvatarPiece = (typeof AVATAR_PIECES)[number];

export const AVATAR_COLORS = [
	'red',
	'orange',
	'yellow',
	'lime',
	'green',
	'teal',
	'sky',
	'blue',
	'violet',
	'pink',
	'brown',
	'slate',
	'ivory',
	'ink',
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

export interface Avatar {
	readonly piece: AvatarPiece;
	readonly color: AvatarColor;
	readonly background: AvatarColor;
}

export const avatarSchema = z
	.object({
		piece: z.enum(AVATAR_PIECES),
		color: z.enum(AVATAR_COLORS),
		background: z.enum(AVATAR_COLORS),
	})
	.refine((avatar) => avatar.color !== avatar.background, {
		path: ['background'],
		message: 'must differ from color',
	});

export type UpdateAvatarRequest = z.input<typeof avatarSchema>;

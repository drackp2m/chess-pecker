import { AVATAR_COLORS, AVATAR_PIECES } from '@chesspecker/api-definitions';
import type { Avatar } from '@chesspecker/api-definitions';
import { describe, expect, it } from 'vitest';

import { deriveAvatar, resolveAvatar } from '@app/util/avatar';

const UUIDS = Array.from(
	{ length: 200 },
	(_, index) => `0b6f${index.toString(16).padStart(4, '0')}-8c1d-4d2e-9f3a-1e2d3c4b5a69`,
);

describe('deriveAvatar', () => {
	it('gives the same uuid the same avatar every time', () => {
		expect(deriveAvatar(UUIDS[0] ?? '')).toStrictEqual(deriveAvatar(UUIDS[0] ?? ''));
	});

	it('only uses pieces and colours of the closed palette', () => {
		for (const uuid of UUIDS) {
			const avatar = deriveAvatar(uuid);

			expect(AVATAR_PIECES).toContain(avatar.piece);
			expect(AVATAR_COLORS).toContain(avatar.color);
			expect(AVATAR_COLORS).toContain(avatar.background);
		}
	});

	it('never paints the piece in the colour of its background', () => {
		for (const uuid of UUIDS) {
			const avatar = deriveAvatar(uuid);

			expect(avatar.color).not.toBe(avatar.background);
		}
	});

	it('spreads different accounts over more than one avatar', () => {
		const distinct = new Set(UUIDS.map((uuid) => JSON.stringify(deriveAvatar(uuid))));

		expect(distinct.size).toBeGreaterThan(UUIDS.length / 2);
	});
});

describe('resolveAvatar', () => {
	const chosen: Avatar = { piece: 'queen', color: 'ivory', background: 'ink' };

	it('keeps the avatar the person chose', () => {
		expect(resolveAvatar('uuid', chosen)).toBe(chosen);
	});

	it('falls back to the derived one when there is none, or the row predates avatars', () => {
		expect(resolveAvatar('uuid', null)).toStrictEqual(deriveAvatar('uuid'));
		expect(resolveAvatar('uuid', undefined)).toStrictEqual(deriveAvatar('uuid'));
	});
});

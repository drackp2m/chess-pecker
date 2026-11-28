import { AVATAR_COLORS, AVATAR_PIECES } from '@chesspecker/api-definitions';
import type { Avatar } from '@chesspecker/api-definitions';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function hashOf(value: string): number {
	let hash = FNV_OFFSET;

	for (const character of value) {
		hash = Math.imul(hash ^ character.charCodeAt(0), FNV_PRIME);
	}

	return hash >>> 0;
}

function pick<T>(items: readonly T[], index: number): T {
	return items[index % items.length] as T;
}

export function deriveAvatar(uuid: string): Avatar {
	const hash = hashOf(uuid);
	const color = pick(AVATAR_COLORS, hash);
	const backgrounds = AVATAR_COLORS.filter((candidate) => candidate !== color);

	return {
		piece: pick(AVATAR_PIECES, Math.floor(hash / AVATAR_COLORS.length)),
		color,
		background: pick(backgrounds, Math.floor(hash / (AVATAR_COLORS.length * AVATAR_PIECES.length))),
	};
}

export function resolveAvatar(uuid: string, avatar: Avatar | null | undefined): Avatar {
	return avatar ?? deriveAvatar(uuid);
}

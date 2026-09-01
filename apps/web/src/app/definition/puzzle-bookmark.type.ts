import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';

import { I18n } from '@app/i18n';

/**
 * The lists an exercise can be filed under, in the order the modal offers them. Only one at
 * a time: filing an exercise again moves it.
 */
export const PUZZLE_BOOKMARK_TYPES: readonly PuzzleBookmarkType[] = [
	'favorite',
	'hard',
	'easy',
	'unclear',
];

/** The one a plain press files into when the modal is not being asked for. */
export const DEFAULT_PUZZLE_BOOKMARK_TYPE: PuzzleBookmarkType = 'favorite';

export const PUZZLE_BOOKMARK_LABEL = {
	favorite: I18n.common.BOOKMARK_FAVORITE,
	hard: I18n.common.BOOKMARK_HARD,
	easy: I18n.common.BOOKMARK_EASY,
	unclear: I18n.common.BOOKMARK_UNCLEAR,
} as const satisfies Record<PuzzleBookmarkType, string>;

/** Whether the modal has to be asked for. Only favorites can be filed without it. */
export const DEFAULT_BOOKMARK_PROMPT = true;

export function normalizeBookmarkPrompt(value: unknown): boolean {
	return 'boolean' === typeof value ? value : DEFAULT_BOOKMARK_PROMPT;
}

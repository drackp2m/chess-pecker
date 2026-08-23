import { InjectionToken } from '@angular/core';

import { I18n } from '@app/i18n';

/**
 * How a move may be entered on the board. Click-then-click selects the piece and
 * then its destination; drag picks the piece up and drops it.
 */
export type MoveInputMethod = 'click' | 'drag';

export const MOVE_INPUT_METHODS_ALL: readonly MoveInputMethod[] = ['click', 'drag'];

/**
 * The one kept when a selection would otherwise be empty: a board accepting no input is a
 * bug, and clicking is the method that also works from the keyboard.
 */
export const FALLBACK_MOVE_INPUT_METHODS: readonly MoveInputMethod[] = ['click'];

/**
 * Default set of input methods. The settings screen overrides it per user; the
 * token stays as the seam for tests and for narrowing the board elsewhere.
 */
export const MOVE_INPUT_METHODS = new InjectionToken<readonly MoveInputMethod[]>(
	'MOVE_INPUT_METHODS',
	{
		providedIn: 'root',
		factory: (): readonly MoveInputMethod[] => MOVE_INPUT_METHODS_ALL,
	},
);

/** Human-readable name of each method, for the settings screen. */
export const MOVE_INPUT_LABEL = {
	click: I18n.setting.INPUT_CLICK,
	drag: I18n.setting.INPUT_DRAG,
} as const satisfies Record<MoveInputMethod, string>;

/** Turns two checkbox states into a selection, never letting it end up empty. */
export function buildMoveInputMethods(
	isClickEnabled: boolean,
	isDragEnabled: boolean,
): readonly MoveInputMethod[] {
	const methods = MOVE_INPUT_METHODS_ALL.filter((method) =>
		'click' === method ? isClickEnabled : isDragEnabled,
	);

	return 0 === methods.length ? FALLBACK_MOVE_INPUT_METHODS : methods;
}

/** Reads a stored value back, dropping anything unrecognised. */
export function normalizeMoveInputMethods(
	value: unknown,
	fallback: readonly MoveInputMethod[] = FALLBACK_MOVE_INPUT_METHODS,
): readonly MoveInputMethod[] {
	if (!Array.isArray(value)) {
		return fallback;
	}

	const methods = MOVE_INPUT_METHODS_ALL.filter((method) => value.includes(method));

	return 0 === methods.length ? fallback : methods;
}

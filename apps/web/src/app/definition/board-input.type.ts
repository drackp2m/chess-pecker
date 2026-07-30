import { InjectionToken } from '@angular/core';

/**
 * How a move may be entered on the board. Click-then-click selects the piece and
 * then its destination; drag picks the piece up and drops it.
 */
export type MoveInputMethod = 'click' | 'drag';

export const MOVE_INPUT_METHODS_ALL: readonly MoveInputMethod[] = ['click', 'drag'];

/**
 * The one to keep when a selection would otherwise be empty. A board that accepts
 * no input at all is a bug rather than a preference, and clicking is the method
 * that also works from the keyboard.
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
export const MOVE_INPUT_LABEL: Record<MoveInputMethod, string> = {
	click: 'Click the piece, then its destination',
	drag: 'Drag the piece to its destination',
};

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

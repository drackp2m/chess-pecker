import { InjectionToken } from '@angular/core';

/**
 * How a move may be entered on the board. Click-then-click selects the piece and
 * then its destination; drag picks the piece up and drops it.
 */
export type MoveInputMethod = 'click' | 'drag';

export const MOVE_INPUT_METHODS_ALL: readonly MoveInputMethod[] = ['click', 'drag'];

/**
 * Which input methods the board accepts. Both are on by default; override the
 * token to narrow it — a settings screen can provide it from the stored
 * preference without the board component changing at all.
 */
export const MOVE_INPUT_METHODS = new InjectionToken<readonly MoveInputMethod[]>(
	'MOVE_INPUT_METHODS',
	{
		providedIn: 'root',
		factory: (): readonly MoveInputMethod[] => MOVE_INPUT_METHODS_ALL,
	},
);

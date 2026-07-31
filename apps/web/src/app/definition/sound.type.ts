/**
 * A sound the board can make when a move lands. `move` is the ordinary case and is
 * drawn at random from a pool; the rest are fixed, so they stay recognisable.
 *
 * `capture` and `check` deliberately share a clip: both say "something happened here"
 * and the board makes the difference obvious on sight.
 */
export type MoveSound = 'move' | 'capture' | 'check' | 'checkmate';

/**
 * Which way the board is going. Stepping back through a line plays the same clips
 * reversed, so navigating history never sounds like playing a move.
 */
export type SoundDirection = 'forward' | 'backward';

/** How many interchangeable variants `move` picks from, as `move-1` … `move-N`. */
export const MOVE_SOUND_VARIANTS = 5;

function variants(prefix: string): readonly string[] {
	return Array.from(
		{ length: MOVE_SOUND_VARIANTS },
		(_, index) => `/sound/move/${prefix}-${String(index + 1)}.opus`,
	);
}

/** Where each sound is served from, relative to the app root. */
export const SOUND_SOURCE: Record<SoundDirection, Record<MoveSound, readonly string[]>> = {
	forward: {
		move: variants('move'),
		capture: ['/sound/check.opus'],
		check: ['/sound/check.opus'],
		checkmate: ['/sound/checkmate.opus'],
	},
	backward: {
		move: variants('reverse-move'),
		capture: ['/sound/reverse-check.opus'],
		check: ['/sound/reverse-check.opus'],
		checkmate: ['/sound/reverse-checkmate.opus'],
	},
};

/** Sound is on unless it has been turned off; a silent board reads as broken. */
export const DEFAULT_SOUND_ENABLED = true;

export function normalizeSoundEnabled(value: unknown): boolean {
	return 'boolean' === typeof value ? value : DEFAULT_SOUND_ENABLED;
}

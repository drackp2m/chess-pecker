import { ChessMove, Square } from '@app/definition/chess.type';

/**
 * How much of the board's movement to animate, from most to least. Each level is a
 * strict subset of the one before it.
 */
export type MoveAnimation =
	/** Every change of position, rewinding included. */
	| 'always'
	/** Playing a move and stepping forward, but never stepping back. */
	| 'forward'
	/** Only a move as it is actually played; navigating the line is instant. */
	| 'first'
	/** Nothing slides; pieces just appear where they belong. */
	| 'never';

export const MOVE_ANIMATIONS: readonly MoveAnimation[] = ['always', 'forward', 'first', 'never'];

export const DEFAULT_MOVE_ANIMATION: MoveAnimation = 'first';

export type BoardTransitionKind =
	/** A move was played for the first time. */
	| 'played'
	/** An already played move was replayed by stepping forward. */
	| 'forward'
	/** A move was taken back; `from` and `to` are reversed. */
	| 'backward';

/** What the board just did, so it can be animated — or deliberately not. */
export interface BoardTransition {
	readonly from: Square;
	/** The square that receives the slide. */
	readonly to: Square;
	readonly kind: BoardTransitionKind;
	/** Identifies this board event, so the same slide never runs twice. */
	readonly tick: number;
}

/**
 * Board events so far, counted here rather than in any store on purpose. A slide is
 * keyed by its tick, and a piece that is handed the key of a slide it has already run
 * will not run it again — so a tick may never come round a second time. Every store
 * clears its transition when the board jumps rather than moves (a restart, a rewind,
 * a new game), and a count kept alongside it would be cleared with it: the next move
 * would then be handed tick 1 again, and a piece still standing where an earlier
 * tick 1 had landed would sit there refusing to slide.
 */
let lastTick = 0;

/** Builds the transition for a board event, under a tick nothing else can hold. */
export function nextTransition(move: ChessMove, kind: BoardTransitionKind): BoardTransition {
	// A move being taken back travels the other way, so the squares swap.
	const isReversed = 'backward' === kind;

	lastTick += 1;

	return {
		from: isReversed ? move.to : move.from,
		to: isReversed ? move.from : move.to,
		kind,
		tick: lastTick,
	};
}

export function shouldAnimate(kind: BoardTransitionKind, setting: MoveAnimation): boolean {
	switch (setting) {
		case 'always':
			return true;
		case 'forward':
			return 'backward' !== kind;
		case 'first':
			return 'played' === kind;
		case 'never':
			return false;
	}
}

/** Human-readable name of each level, for the settings screen. */
export const MOVE_ANIMATION_LABEL: Record<MoveAnimation, string> = {
	always: 'Always',
	forward: 'Only going forward',
	first: 'Only when first played',
	never: 'Never',
};

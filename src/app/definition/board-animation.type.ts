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
	/** Increments per transition, so the same slide never runs twice. */
	readonly tick: number;
}

/** Builds the next transition, carrying the tick forward so slides stay unique. */
export function nextTransition(
	previous: BoardTransition | undefined,
	move: ChessMove,
	kind: BoardTransitionKind,
): BoardTransition {
	// A move being taken back travels the other way, so the squares swap.
	const isReversed = 'backward' === kind;

	return {
		from: isReversed ? move.to : move.from,
		to: isReversed ? move.from : move.to,
		kind,
		tick: (previous?.tick ?? 0) + 1,
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

import { ChessPosition, Square } from '@app/definition/chess.type';
import { MoveSound } from '@app/definition/sound.type';

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
	/** A move was taken back; its beats run in reverse, and so does each slide. */
	| 'backward';

/** One piece on its way across the board. */
export interface BoardSlideStep {
	readonly from: Square;
	/** The square that receives the slide. */
	readonly to: Square;
}

/**
 * One beat of a board event. An ordinary move takes one; the two that move a second
 * piece take two, castling because the king and the rook travel one after the other,
 * en passant because the square captured on has to be stepped onto first.
 */
export interface BoardStage {
	/** Everything that travels together, so a stage of two moves two pieces at once. */
	readonly slides: readonly BoardSlideStep[];
	/**
	 * The board this beat lands on, carried only while another beat follows it. It
	 * lives no longer than the animation does and reaches neither `positions` nor the
	 * record; the last beat lands on the position the state itself moved to, which is
	 * what `undefined` says.
	 */
	readonly board: ChessPosition | undefined;
	/**
	 * What this beat sounds like as it sets off, so a move that travels two pieces is
	 * heard twice — the plain clip for the piece that only travels, and what the move
	 * itself came to for the one that lands it.
	 */
	readonly sound: MoveSound;
	/** Identifies this beat, so the same slide never runs twice. */
	readonly tick: number;
}

/** What the board just did, so it can be animated — or deliberately not. */
export interface BoardTransition {
	readonly kind: BoardTransitionKind;
	/** The beats it takes, in the order they are to run. */
	readonly stages: readonly BoardStage[];
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

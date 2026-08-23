import { ChessPosition, Piece, Square } from '@app/definition/chess.type';
import { MoveSound } from '@app/definition/sound.type';
import { I18n } from '@app/i18n';

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
	/**
	 * What the slide will take, left standing until it arrives. A square holds one piece, so
	 * the one being taken travels here rather than on any board.
	 */
	readonly taken: Piece | undefined;
}

/**
 * One beat of a board event. An ordinary move takes one; castling and en passant take two,
 * since both move a second piece.
 */
export interface BoardStage {
	/** Everything that travels together, so a stage of two moves two pieces at once. */
	readonly slides: readonly BoardSlideStep[];
	/**
	 * The board this beat lands on, carried only while another follows and reaching neither
	 * `positions` nor the record. `undefined` means the position the state moved to.
	 */
	readonly board: ChessPosition | undefined;
	/**
	 * What this beat sounds like, so a move travelling two pieces is heard twice. A beat that
	 * moves nothing — a pawn turning into a queen — is silent.
	 */
	readonly sound: MoveSound | undefined;
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
export const MOVE_ANIMATION_LABEL = {
	always: I18n.setting.ANIMATION_ALWAYS,
	forward: I18n.setting.ANIMATION_FORWARD,
	first: I18n.setting.ANIMATION_FIRST,
	never: I18n.setting.ANIMATION_NEVER,
} as const satisfies Record<MoveAnimation, string>;

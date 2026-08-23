import { ChessMoveRecord, PieceColor } from '@app/definition/chess.type';

/**
 * One exercise in the Lichess puzzle-database shape: `fen` is the position before the
 * opponent's `moves[0]`, and odd indexes from there are the moves the player must find.
 */
export interface Puzzle {
	readonly id: string;
	readonly fen: string;
	/** Moves in long algebraic (UCI) form, e.g. `f1f8` or `e7e8q`. */
	readonly moves: readonly string[];
	readonly rating: number;
	readonly themes: readonly string[];
	readonly selectedFor: string;
}

/**
 * How the attempt was graded, settled on the first try and never revised. Settling it does
 * not end the exercise: that is what `PuzzleClosure` says.
 */
export type PuzzleResult = 'solved' | 'failed';

/**
 * Whether the exercise is over, which is not how it was graded: it runs until the solution
 * is out, played by the player or handed to them.
 */
export type PuzzleClosure =
	/** Still being solved, however many misses and retries it has taken. */
	| 'open'
	/** The player played the whole line out on the board. */
	| 'found'
	/** The player gave up, and the rest of the line was played out for them. */
	| 'revealed';

/** The first closure reached is the one kept, so watching the answer cannot undo a `found`. */
export function settleClosure(current: PuzzleClosure, closure: PuzzleClosure): PuzzleClosure {
	return 'open' === current ? closure : current;
}

/** What the board is currently showing, which a rewound cursor changes freely. */
export type PuzzleOutcome =
	/** No exercise loaded. */
	| 'idle'
	/** Replaying the opponent's opening move. */
	| 'opening'
	/** Waiting for the player's move. */
	| 'solving'
	/** The opponent's scripted reply is being played. */
	| 'replying'
	/**
	 * A move left the script. It is taken back on its own so the exercise can be retried;
	 * playing on instead switches the board to free play.
	 */
	| 'failed'
	/** The whole line was found. */
	| 'solved';

/**
 * The first verdict reached is the one kept, so a `solved` after a retry never replaces a
 * `failed` already recorded.
 */
export function settleResult(
	current: PuzzleResult | undefined,
	outcome: PuzzleOutcome,
): PuzzleResult | undefined {
	if (undefined !== current) {
		return current;
	}

	return 'solved' === outcome || 'failed' === outcome ? outcome : undefined;
}

/**
 * How long the exercise must have been looked at before the hint is offered. Watched time,
 * like the attempt's own duration, so a backgrounded tab waits for nothing.
 */
export const HINT_DELAY_MS = 30_000;

/**
 * One thing that happened while solving: a UCI move, a signed run of cursor steps, `0` for a
 * restart, or the hint marker. Replaying a prefix rebuilds one and only one board.
 */
export type PuzzleEvent = string | number;

/** A visit to free play: where the main line stood, and what was played inside. */
export interface FreePlayRun {
	/** How many events of the main line had happened at the moment it was entered. */
	readonly at: number;
	/** The events inside, encoded exactly like the ones outside. */
	readonly events: readonly PuzzleEvent[];
}

/** How an exercise was solved: the main line, and the explorations hanging off it. */
export interface PuzzleRecord {
	/** Every event outside free play, in the order they happened. */
	readonly record: readonly PuzzleEvent[];
	/** Every exploration into free play, in the order they were entered. */
	readonly explorations: readonly FreePlayRun[];
}

/** A move played during a session, plus where it came from. */
export interface PuzzleMove extends ChessMoveRecord {
	readonly isOpponent: boolean;
}

export interface PuzzleParseResult {
	readonly puzzles: readonly Puzzle[];
	/** Rows that could not be read, so the UI can say how many were dropped. */
	readonly skipped: number;
}

export interface PuzzleProgress {
	readonly solvedMoves: number;
	readonly totalMoves: number;
	readonly playerColor: PieceColor;
}

/** How hard an exercise reads at a glance, from its rating's last two digits. */
export type PuzzleDifficulty = 'easy' | 'medium' | 'hard';

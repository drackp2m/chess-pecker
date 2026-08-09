import { ChessMoveRecord, PieceColor } from '@app/definition/chess.type';

/**
 * One exercise in the Lichess puzzle-database shape.
 *
 * The encoding is not obvious: `fen` is the position *before* the opponent's last
 * move, and `moves[0]` is that opponent move, replayed for you when the puzzle
 * opens. Everything after it alternates — odd indexes are the moves you must find,
 * even indexes are the opponent's scripted replies. The side to move in `fen` is
 * therefore the opponent, and you play the opposite colour.
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
 * How the attempt was graded, settled the first time the exercise is either finished
 * or left the script, and never revised after that. Woodpecker scores the first try,
 * so anything played from there on — a retry, a reveal — leaves this untouched.
 *
 * Settling it does not end the exercise: that is what `PuzzleClosure` says.
 */
export type PuzzleResult = 'solved' | 'failed';

/**
 * Whether the exercise is over, which is a different question from how it was graded:
 * the note is sealed on the first try, but the exercise itself runs until the solution
 * is out — played by the player, or handed over to them when they give up.
 */
export type PuzzleClosure =
	/** Still being solved, however many misses and retries it has taken. */
	| 'open'
	/** The player played the whole line out on the board. */
	| 'found'
	/** The player gave up, and the rest of the line was played out for them. */
	| 'revealed';

/**
 * The closure to keep: the first one the exercise reaches is the one it ended on, so
 * an answer watched after the line was found never turns a `found` into a `revealed`.
 */
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
	 * A move left the script. It stays up long enough to be seen and is then taken
	 * back on its own, so the exercise can be tried again; playing on instead of
	 * waiting switches the board to free play.
	 */
	| 'failed'
	/** The whole line was found. */
	| 'solved';

/**
 * The verdict to keep. The first one the exercise reaches is the one it is graded on,
 * so a later `solved` — after a retry, or after the solution was played out — never
 * replaces the `failed` that was already recorded.
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
 * How long the exercise has to have been looked at before the hint is offered. Help taken
 * on sight is not help: the themes stay covered until the position has really been read.
 *
 * It is measured the same way the attempt's own duration is — watched time, so a tab left
 * in the background waits for nothing and the themes are not there on coming back. No move
 * speed scales it either, and no restart winds it back: the position has been on screen
 * for as long as it has been.
 */
export const HINT_DELAY_MS = 30_000;

/**
 * One thing that happened while the exercise was being solved: a move in UCI, a run
 * of cursor steps as a signed count, `0` for a restart, or the marker for the hint.
 * Replaying a prefix of them rebuilds one and only one board, which is what the whole
 * format rests on — the marker is the one event that moves nothing, and says only that
 * help was taken, and exactly when.
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

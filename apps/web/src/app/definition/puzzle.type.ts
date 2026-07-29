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

// ToDo => this outcome is a *view* state, not a result. `failed` is reversible by
// rewinding the cursor, and once the line is back on the script the exercise reads
// `solved` with nothing left to say that the first attempt was wrong. Woodpecker
// grades on exactly that — first-try correct, and how long it took — so the result of
// an attempt has to be recorded separately from what the board is currently showing,
// and settled at the moment the first player move is committed rather than at the end.
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
	 * A move left the script. It stays on the board and play continues freely from
	 * there, both sides by hand, until the cursor is rewound back onto the solution.
	 */
	| 'failed'
	/** The whole line was found. */
	| 'solved';

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

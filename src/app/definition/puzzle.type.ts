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
	readonly popularity: number;
	readonly nbPlays: number;
	readonly themes: readonly string[];
	readonly gameUrl: string;
	readonly selectedFor: string;
}

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

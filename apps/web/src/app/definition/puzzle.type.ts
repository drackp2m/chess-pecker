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
 */
export type PuzzleResult = 'solved' | 'failed';

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
	 * A move left the script. What happens next is the user's to choose: the move can
	 * be taken back on its own, the position can be played on freely with both sides
	 * by hand, or the board can be locked until the cursor is rewound onto the
	 * solution — see `MistakePolicy`.
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

import { BoardTransition } from '@app/definition/board-animation.type';
import { PendingPromotion } from '@app/definition/board-presenter.interface';
import {
	ChessMove,
	ChessPosition,
	PieceColor,
	PromotionPieceType,
	Square,
} from '@app/definition/chess.type';
import { PlaybackTag } from '@app/definition/playback.type';
import {
	Puzzle,
	PuzzleClosure,
	PuzzleEvent,
	PuzzleMove,
	PuzzleOutcome,
	PuzzleProgress,
	PuzzleRecord,
	PuzzleResult,
	settleClosure,
} from '@app/definition/puzzle.type';
import { blankRecord } from '@app/page/puzzle/store/puzzle/record';
import { nextTransition } from '@app/util/chess/board-transition';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessNotation } from '@app/util/chess/chess-notation';

/**
 * What the exercise holds that the log cannot say. The line, the positions and the cursor
 * are derived in `withPuzzleComputed` by folding the log, never stored here.
 */
export interface PuzzleStoreProps extends PuzzleRecord {
	/** Which free-play run is open, as an index into `freePlayRuns`, or none. */
	freePlayIndex: number | undefined;
	freePlayScratch: readonly PuzzleEvent[] | undefined;
	/**
	 * Plies the board stands behind the log, which the log must not hear about: the beat
	 * before a piece leaves its square, and any step taken once the record is sealed.
	 */
	rewound: number;
	/** The answer played out after the exercise was given up on, or none. */
	revealed: RevealedLine | undefined;
	/** The board the exercise opened on, which the fold replays the log onto. */
	fen: string;
	/** The opponent's scripted move, lit up before it is replayed. */
	announced: ChessMove | undefined;
	/** What the board last did, for the animation policy to judge. */
	transition: BoardTransition | undefined;
	playerColor: PieceColor;
	orientation: PieceColor;
	selected: Square | undefined;
	pendingPromotion: PendingPromotion | undefined;
	outcome: PuzzleOutcome;
	/** The graded verdict, kept once it is settled however the board moves on. */
	result: PuzzleResult | undefined;
	/** Whether the exercise is over, and how it got there. */
	closure: PuzzleClosure;
	/** The themes have been looked at, which counts as help. */
	hintUsed: boolean;
	/** The exercise has been open long enough for the hint to be on offer at all. */
	hintUnlocked: boolean;
	/** Wrong moves in this exercise, counted from the moment it was opened. */
	mistakeCount: number;
	playback: PlaybackTag | undefined;
}

/**
 * The answer played out after giving up. The record is closed by then and takes none of it,
 * so `at` anchors it to a fixed stretch of line that `rewound` can walk.
 */
export interface RevealedLine {
	/** The ply it is played from, as an index into the line the log folds to. */
	readonly at: number;
	readonly moves: readonly string[];
}

/** The played line, derived by replaying the log rather than kept in the store. */
export interface LineState {
	/** `positions[k]` is the position after `k` moves of the line; `[0]` is the FEN. */
	readonly positions: ChessPosition[];
	/** Every move played, right or wrong: one off the script is kept so free play works. */
	readonly line: PuzzleMove[];
	/** Which position is on screen: `0` … `line.length`. */
	readonly cursor: number;
}

/** What reopening the same exercise carries over: the grade, the closure and the help spent. */
export type PuzzleVerdict = Pick<
	PuzzleStoreProps,
	'result' | 'closure' | 'hintUsed' | 'mistakeCount'
>;

/** The line free play began from, plus the deviation it had reached. */
export interface FreePlayAnchor extends LineState {
	readonly deviation: number | undefined;
}

export function buildPuzzleState(): PuzzleStoreProps {
	return {
		...blankRecord(),
		freePlayIndex: undefined,
		freePlayScratch: undefined,
		rewound: 0,
		revealed: undefined,
		fen: ChessFen.serialize(ChessFen.initial()),
		announced: undefined,
		transition: undefined,
		playerColor: 'white',
		orientation: 'white',
		selected: undefined,
		pendingPromotion: undefined,
		outcome: 'idle',
		result: undefined,
		closure: 'open',
		hintUsed: false,
		hintUnlocked: false,
		mistakeCount: 0,
		playback: undefined,
	};
}

/** A board with nothing played yet: only what the fold has no say over. */
function startLine(fen: string): Partial<PuzzleStoreProps> {
	return {
		...blankRecord(),
		fen,
		freePlayIndex: undefined,
		freePlayScratch: undefined,
		rewound: 0,
		revealed: undefined,
		announced: undefined,
		transition: undefined,
		selected: undefined,
		pendingPromotion: undefined,
	};
}

/**
 * Opens an exercise at its raw FEN. The side to move is the opponent, about to play
 * `moves[0]`, so the player takes the other colour.
 */
export function openPuzzle(puzzle: Puzzle): Partial<PuzzleStoreProps> {
	const position = ChessFen.parse(puzzle.fen);
	const playerColor: PieceColor = 'white' === position.turn ? 'black' : 'white';

	return {
		...startLine(puzzle.fen),
		playerColor,
		orientation: playerColor,
		outcome: 'opening',
		result: undefined,
		closure: 'open',
		hintUsed: false,
		hintUnlocked: false,
		mistakeCount: 0,
		// Naming a programme without running it would leave the board busy for good.
		playback: undefined,
	};
}

/** What a saved exercise puts back on the board, beyond the line the record folds to. */
export type PuzzleRestore = PuzzleRecord & PuzzleVerdict;

/**
 * The board a saved exercise reopens on. The line comes from folding its record and the
 * verdict from the row, sealed while it was solved; `restoredTransition` owns the slide.
 */
export function restorePatch(
	stored: PuzzleRestore,
	playerColor: PieceColor,
): Partial<PuzzleStoreProps> {
	return {
		record: stored.record,
		freePlayRuns: stored.freePlayRuns,
		result: stored.result,
		closure: stored.closure,
		hintUsed: stored.hintUsed,
		mistakeCount: stored.mistakeCount,
		// A manual flip is a preference of the moment, so nothing stores it.
		orientation: playerColor,
		// Nothing comes back in flight: the record never said what was open when it was saved.
		freePlayIndex: undefined,
		freePlayScratch: undefined,
		rewound: 0,
		revealed: undefined,
		announced: undefined,
		selected: undefined,
		pendingPromotion: undefined,
		playback: undefined,
	};
}

/**
 * The only slide a restore animates: the last move before the cursor, travelled forward.
 * How the board reached that point is history, and history does not replay itself.
 */
export function restoredTransition(state: LineState): BoardTransition | undefined {
	const move = state.line[state.cursor - 1];
	const played = state.positions[state.cursor - 1];

	if (undefined === move || undefined === played) {
		return undefined;
	}

	return nextTransition(played, move, 'forward');
}

export function anchorFreePlay(state: LineState, deviation: number | undefined): FreePlayAnchor {
	return { positions: state.positions, line: state.line, cursor: state.cursor, deviation };
}

/** What a rewind has to look at to know whether the board is about to jump. */
interface RewindState {
	readonly cursor: number;
	readonly transition: BoardTransition | undefined;
}

/**
 * The slide a rewind leaves standing. Landing on the same cursor changes nothing, so a
 * slide in flight is still true; anywhere else the position jumps and it would be a lie.
 */
function keptTransition(state: RewindState, cursor: number): BoardTransition | undefined {
	return cursor === state.cursor ? state.transition : undefined;
}

/**
 * Leaves the free-play run. The sandbox stays in the log as the variation it was, so letting
 * go of it is all it takes for the fold to return to the line it hung off. A closed exercise
 * keeps its rewind: it is not a beat in flight but where the board was left standing.
 */
export function restoreFreePlayPatch(
	state: RewindState,
	anchor: FreePlayAnchor,
	isScratch: boolean,
): Partial<PuzzleStoreProps> {
	return {
		freePlayIndex: undefined,
		freePlayScratch: undefined,
		// A beat the sandbox had in flight is dropped: the line comes back as it was picked up.
		...(isScratch ? {} : { rewound: 0 }),
		announced: undefined,
		selected: undefined,
		pendingPromotion: undefined,
		playback: undefined,
		transition: keptTransition(state, anchor.cursor),
	};
}

/**
 * Where a restart inside a free-play run puts the cursor: back on the main line it was
 * entered from, skipping the wrong move that line was left standing on.
 */
export function freePlayRestartCursor(anchor: FreePlayAnchor): number {
	return anchor.deviation ?? anchor.line.length;
}

/**
 * What starting over clears before the opening move is shown again. Nothing here rewinds:
 * the rewind that follows measures from the board the log describes. The sandbox of a closed
 * exercise keeps both the rewind and the answer: they are the line it hangs off.
 */
export function restartPatch(
	closure: PuzzleClosure,
	isScratch: boolean,
): Partial<PuzzleStoreProps> {
	// A closed record takes no restart, so its played-out answer is let go of by hand.
	const spent = 'open' === closure ? { rewound: 0 } : { rewound: 0, revealed: undefined };

	return {
		announced: undefined,
		selected: undefined,
		pendingPromotion: undefined,
		transition: undefined,
		...(isScratch ? {} : spent),
	};
}

/**
 * How far back giving up rewinds: onto the ply where the line stopped following the
 * script, so the solution can be played out from there.
 */
export function revealCursor(state: LineState, deviation: number | undefined): number {
	return Math.min(state.cursor, deviation ?? state.cursor);
}

/**
 * What giving up does beyond the rewind. Nothing unwrites the log, so the strayed moves
 * stay behind the cursor as the variation they were; only the rewind itself is recorded.
 */
export function revealPatch(
	state: RewindState & Pick<PuzzleStoreProps, 'closure'>,
	cursor: number,
): Partial<PuzzleStoreProps> {
	return {
		announced: undefined,
		selected: undefined,
		pendingPromotion: undefined,
		transition: keptTransition(state, cursor),
		closure: settleClosure(state.closure, 'revealed'),
		// Asked for again, the answer replays afresh instead of onto the end of the last one.
		revealed: undefined,
		rewound: 0,
		playback: undefined,
	};
}

/**
 * The whole answer, parsed forward from the ply it starts at: a programme walks a line that
 * already exists. Cut where a move stops parsing, since what was read is still worth watching.
 */
export function revealedLine(
	positions: readonly ChessPosition[],
	scripted: readonly string[],
	at: number,
): RevealedLine {
	const anchor = positions[at];

	if (undefined === anchor) {
		return { at, moves: [] };
	}

	const moves: string[] = [];
	let board = anchor;

	for (const written of scripted.slice(at)) {
		const move = ChessNotation.parse(board, written);

		if (undefined === move) {
			break;
		}

		moves.push(ChessNotation.describeLong(move));
		board = ChessBoard.apply(board, move);
	}

	return { at, moves };
}

export function toRecord(
	position: ChessPosition,
	move: ChessMove,
	isOpponent: boolean,
): PuzzleMove {
	return {
		...move,
		san: ChessNotation.describe(position, move),
		fullmoveNumber: position.fullmoveNumber,
		isOpponent,
	};
}

/**
 * Whether an attempt counts as the solution: the scripted move, or any move that mates,
 * since a mating puzzle is satisfied by any mate. Lichess grades them the same way.
 */
export function isSolution(
	position: ChessPosition,
	move: ChessMove,
	expected: string | undefined,
): boolean {
	if (undefined === expected) {
		return false;
	}

	const scripted = ChessNotation.parse(position, expected);

	if (
		scripted?.from === move.from &&
		scripted.to === move.to &&
		scripted.promotion === move.promotion
	) {
		return true;
	}

	// No history: an exercise is a position and a script, not a game that got here.
	return 'checkmate' === ChessMoveGenerator.status(ChessBoard.apply(position, move), []);
}

/**
 * What an accepted move leaves behind, the log aside. The line is not written here:
 * appending to the log grows it, and the fold picks the new ply up on its own.
 */
export function commitPatch(position: ChessPosition, move: ChessMove): Partial<PuzzleStoreProps> {
	return {
		selected: undefined,
		pendingPromotion: undefined,
		transition: nextTransition(position, move, 'played'),
	};
}

/**
 * Player moves found so far; the opponent's plies occupy the even indexes. Free-play
 * moves are not progress, so the count stops at the deviation.
 */
export function describeProgress(
	cursor: number,
	puzzle: Puzzle | undefined,
	playerColor: PieceColor,
	deviation: number | undefined,
): PuzzleProgress {
	return {
		solvedMoves: Math.floor(Math.min(cursor, deviation ?? cursor) / 2),
		totalMoves: Math.floor((puzzle?.moves.length ?? 0) / 2),
		playerColor,
	};
}

/** The promotion variant of a pending move, once the player has picked a piece. */
export function findPromotion(
	legalMoves: readonly ChessMove[],
	pending: PendingPromotion,
	promotion: PromotionPieceType,
): ChessMove | undefined {
	return legalMoves.find(
		(candidate) =>
			candidate.from === pending.from &&
			candidate.to === pending.to &&
			candidate.promotion === promotion,
	);
}

/**
 * Which square the click selects, or `undefined` to clear the selection. The side
 * to move owns the selection, which off the script is whichever side that is.
 */
export function nextSelection(
	position: ChessPosition,
	square: Square,
	selected: Square | undefined,
): Square | undefined {
	const isOwnPiece = ChessBoard.pieceAt(position, square)?.color === position.turn;

	return isOwnPiece && square !== selected ? square : undefined;
}

/**
 * The ply the line stopped following the script at, or `undefined` while it still does.
 * Rewinding the cursor back to it puts the exercise on the rails with nothing undone.
 */
export function findDeviation(
	state: Omit<LineState, 'cursor'>,
	puzzle: Puzzle | undefined,
): number | undefined {
	if (undefined === puzzle) {
		return undefined;
	}

	for (let ply = 0; ply < state.line.length; ply += 1) {
		const position = state.positions[ply];
		const move = state.line[ply];

		if (
			undefined === position ||
			undefined === move ||
			!isSolution(position, move, puzzle.moves[ply])
		) {
			return ply;
		}
	}

	return undefined;
}

/** Whether the cursor sits past the deviation, where the script no longer applies. */
export function isPastDeviation(deviation: number | undefined, cursor: number): boolean {
	return undefined !== deviation && deviation < cursor;
}

/**
 * Where the exercise stands with the cursor at `cursor`. A mate ends it wherever it lands,
 * cutting the scripted continuation short: replaying it would be illegal anyway.
 */
export function describeOutcome(
	positions: readonly ChessPosition[],
	puzzle: Puzzle,
	deviation: number | undefined,
	cursor: number,
): PuzzleOutcome {
	if (isPastDeviation(deviation, cursor)) {
		return 'failed';
	}

	const position = positions[cursor];
	const isMate = undefined !== position && 'checkmate' === ChessMoveGenerator.status(position, []);

	return cursor >= puzzle.moves.length || isMate ? 'solved' : 'solving';
}

/** The move that broke the script, while it is still the last one on the board. */
export function mistakeAt(
	line: readonly PuzzleMove[],
	cursor: number,
	deviation: number | undefined,
): PuzzleMove | undefined {
	return undefined !== deviation && cursor === deviation + 1 ? line[deviation] : undefined;
}

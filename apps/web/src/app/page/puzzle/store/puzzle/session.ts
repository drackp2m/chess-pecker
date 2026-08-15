import { BoardTransition } from '@app/definition/board-animation.type';
import { PendingPromotion } from '@app/definition/board-presenter.interface';
import {
	ChessMove,
	ChessPosition,
	PieceColor,
	PromotionPieceType,
	Square,
} from '@app/definition/chess.type';
import {
	Puzzle,
	PuzzleClosure,
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
 * What the exercise holds that the log cannot say. The line, the positions behind it and
 * the cursor are not in here: they are the log folded out, derived in `withPuzzleComputed`
 * and never written. What is left is the board's own furniture — what is lit up, what is
 * selected, and how the exercise has been graded.
 */
export interface PuzzleStoreProps extends PuzzleRecord {
	/** Which exploration is open, as an index into `explorations`, or none. */
	freePlayIndex: number | undefined;
	/**
	 * Plies the board is standing behind where the log leaves it, which the log itself
	 * must not hear about. Two things put the cursor here rather than in the record:
	 * the beat that stands a line back on the square a piece is about to leave, which is
	 * animation and not something that happened; and every step taken once the exercise
	 * is closed, when the record is sealed but looking through it never stops being
	 * allowed. Both are undone by the log moving on, so it is cleared whenever it does.
	 */
	rewound: number;
	/**
	 * The answer played out after the exercise was given up on. It reaches the board like
	 * any other move, but the record is closed by the time it does and takes none of it —
	 * so it is folded onto the end of the line from here instead, which is the one place
	 * the board says more than the log does.
	 */
	revealed: readonly string[];
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
	/** The themes have been looked at, which is help and is kept as such. */
	hintUsed: boolean;
	/** The exercise has been open long enough for the hint to be on offer at all. */
	hintUnlocked: boolean;
	/** Wrong moves in this exercise, counted from the moment it was opened. */
	mistakeCount: number;
	isReplaying: boolean;
	/** The rest of the solution is being played out right now. */
	isRevealing: boolean;
}

/**
 * The played line, as the fold hands it back. It was a slice of the store once; it is the
 * result of replaying the log now, and the store derives it rather than keeping it.
 */
export interface LineState {
	/** `positions[k]` is the position after `k` moves of the line; `[0]` is the FEN. */
	readonly positions: ChessPosition[];
	/**
	 * Every move played, right or wrong. A move that leaves the script is kept, so
	 * the board can be played on freely from there until it is rewound.
	 */
	readonly line: PuzzleMove[];
	/** Which position is on screen: `0` … `line.length`. */
	readonly cursor: number;
}

/**
 * What reopening the very same exercise carries over: it has already been graded, it
 * may already be closed, and the help it took is spent whatever the board does next.
 */
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
		rewound: 0,
		revealed: [],
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
		isReplaying: false,
		isRevealing: false,
	};
}

/**
 * A board with nothing played on it yet. Emptying the log is what empties the line now,
 * so what is left here is only the things the fold has no say over.
 */
function startLine(fen: string): Partial<PuzzleStoreProps> {
	return {
		...blankRecord(),
		fen,
		freePlayIndex: undefined,
		rewound: 0,
		revealed: [],
		announced: undefined,
		transition: undefined,
		selected: undefined,
		pendingPromotion: undefined,
	};
}

/**
 * Opens an exercise at its raw FEN. The side to move there is the opponent — it is
 * about to play `moves[0]` — so the player takes the other colour.
 *
 * A fresh exercise means a fresh record; reopening the same one keeps the one it has,
 * which is why the caller gets to put its own back on top.
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
		isReplaying: true,
		isRevealing: false,
	};
}

/** What a saved exercise puts back on the board, beyond the line the record folds to. */
export interface PuzzleRestore extends PuzzleRecord, PuzzleVerdict {
	readonly orientation?: PieceColor;
}

/**
 * The board a saved exercise reopens on. The line comes from folding its record, so what
 * is put back is what was played and not a summary of it, and the verdict comes from the
 * row: the grade was sealed while it was being solved and reopening revises nothing.
 *
 * Nothing is left in flight. An exercise picked up again has no beat pending, no square
 * selected and no exploration standing — the record does not say whether one was open
 * when it was saved, so what comes back is the main line it hangs off.
 *
 * The board it was left flipped to is the one thing the record cannot give back, so it
 * travels on the row; rows written before it was stored fall back to the player's colour.
 *
 * What travels on the way in is `restoredTransition`'s to say, so nothing here touches it.
 */
export function restorePatch(
	stored: PuzzleRestore,
	playerColor: PieceColor,
): Partial<PuzzleStoreProps> {
	return {
		record: stored.record,
		explorations: stored.explorations,
		result: stored.result,
		closure: stored.closure,
		hintUsed: stored.hintUsed,
		mistakeCount: stored.mistakeCount,
		orientation: stored.orientation ?? playerColor,
		freePlayIndex: undefined,
		rewound: 0,
		revealed: [],
		announced: undefined,
		selected: undefined,
		pendingPromotion: undefined,
		isReplaying: false,
		isRevealing: false,
	};
}

/**
 * The slide a restored board comes back with: the last move of the path the cursor is
 * standing at the end of, travelled forward. It is the only thing a restore animates —
 * how the board got to where it was left is history, and history does not replay itself.
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
 * The slide a rewind leaves standing. Landing on the cursor the line already stood on
 * changes nothing on the board, so a slide on its way in is still the truth and has to
 * be allowed to finish — a take-back most of all, since the answer that plays itself
 * afterwards rewinds in the very same breath. Anywhere else the position jumps, and a
 * slide describing the one it left would be a lie.
 */
function keptTransition(state: RewindState, cursor: number): BoardTransition | undefined {
	return cursor === state.cursor ? state.transition : undefined;
}

/**
 * Leaves the exploration the board was in. The sandbox is not unwritten — it stays in the
 * log as the variation it was — so all that closes it is letting go of its index, and the
 * fold goes back to the main line on its own.
 */
export function restoreFreePlayPatch(
	state: RewindState,
	anchor: FreePlayAnchor,
): Partial<PuzzleStoreProps> {
	return {
		freePlayIndex: undefined,
		// A beat the sandbox had in flight is dropped along with it, and so is whatever it
		// was holding the board back by: what comes back is the line as it was picked up.
		rewound: 0,
		announced: undefined,
		selected: undefined,
		pendingPromotion: undefined,
		isReplaying: false,
		transition: keptTransition(state, anchor.cursor),
	};
}

/**
 * Where a restart inside an exploration puts the cursor. Starting over is starting the
 * *exercise* over, so what comes back is the main line the exploration was entered from
 * and not the sandbox that grew out of it — and only what was visible of it: a wrong move
 * the main line was left standing on is not part of the exercise and is skipped over.
 *
 * The sandbox is left in the log where it happened. Leaving the exploration is what takes
 * it off the board, and the restart that follows is written on the main line.
 */
export function explorationRestartCursor(anchor: FreePlayAnchor): number {
	return anchor.deviation ?? anchor.line.length;
}

/**
 * How far back giving up rewinds: onto the ply where the line stopped following the
 * script, so the solution can be played out from there.
 */
export function revealCursor(state: LineState, deviation: number | undefined): number {
	return Math.min(state.cursor, deviation ?? state.cursor);
}

/**
 * What giving up does beyond the rewind. The moves that strayed are not dropped any more —
 * nothing unwrites the log — so the cursor steps back over them and they stay behind it as
 * the variation they always were.
 *
 * Asking for it closes the exercise, so the answer played out from here is not recorded.
 * The rewind onto the script is, as the negative step it really is.
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
		// Asked for again, the answer is played out afresh rather than onto the end of
		// the one before it, and from the board it is really standing on: a beat still
		// holding the cursor behind the line would have it play the wrong ply.
		revealed: [],
		rewound: 0,
		isRevealing: true,
	};
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
 * Whether an attempt counts as the solution. The scripted move always does, and so
 * does any move that delivers mate — a puzzle asking for mate is satisfied by any
 * mate, which is how Lichess grades them too.
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
 * What a move accepted onto the board leaves behind, the log aside. The line itself is
 * not written here any more — appending the move to the log is what grows it, and the
 * fold picks the new ply up on its own.
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
 * The ply at which the line stopped following the script, or `undefined` while it
 * still does. Everything past it is off the script, so rewinding the cursor back to
 * it puts the exercise on the rails again without anything having to be undone.
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
 * Where the exercise stands with the cursor at `cursor`. A mate ends it wherever it
 * lands: any mate solves a mating puzzle, so the scripted continuation may be cut
 * short — and replaying it from a finished position would be illegal anyway.
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

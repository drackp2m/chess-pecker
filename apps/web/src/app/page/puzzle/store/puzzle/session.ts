import { BoardTransition, nextTransition } from '@app/definition/board-animation.type';
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
	PuzzleMove,
	PuzzleOutcome,
	PuzzleProgress,
	PuzzleResult,
} from '@app/definition/puzzle.type';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessNotation } from '@app/util/chess/chess-notation';

export interface PuzzleStoreProps {
	/** `positions[k]` is the position after `k` moves of the line; `[0]` is the FEN. */
	positions: ChessPosition[];
	/**
	 * Every move played, right or wrong. A move that leaves the script is kept, so
	 * the board can be played on freely from there until it is rewound.
	 */
	line: PuzzleMove[];
	/** Which position is on screen: `0` … `line.length`. */
	cursor: number;
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
	/** Where free play started, or `undefined` while it is off. */
	freePlay: FreePlayAnchor | undefined;
	/** Wrong moves in this exercise, counted from the moment it was opened. */
	mistakeCount: number;
	isReplaying: boolean;
	/** The rest of the solution is being played out right now. */
	isRevealing: boolean;
	/** It has been played out at some point, so the board is showing the answer. */
	isRevealed: boolean;
}

/** The slice of state that describes the played line. */
export type LineState = Pick<PuzzleStoreProps, 'positions' | 'line' | 'cursor'>;

/** The line free play began from, plus the deviation it had reached. */
export interface FreePlayAnchor extends LineState {
	readonly deviation: number | undefined;
}

export function buildPuzzleState(): PuzzleStoreProps {
	return {
		positions: [ChessFen.initial()],
		line: [],
		cursor: 0,
		announced: undefined,
		transition: undefined,
		playerColor: 'white',
		orientation: 'white',
		selected: undefined,
		pendingPromotion: undefined,
		outcome: 'idle',
		result: undefined,
		freePlay: undefined,
		mistakeCount: 0,
		isReplaying: false,
		isRevealing: false,
		isRevealed: false,
	};
}

function startLine(position: ChessPosition): Partial<PuzzleStoreProps> {
	return {
		positions: [position],
		line: [],
		cursor: 0,
		announced: undefined,
		transition: undefined,
		selected: undefined,
		pendingPromotion: undefined,
	};
}

export function restartLinePatch(puzzle: Puzzle): Partial<PuzzleStoreProps> {
	return startLine(ChessFen.parse(puzzle.fen));
}

/**
 * Opens an exercise at its raw FEN. The side to move there is the opponent — it is
 * about to play `moves[0]` — so the player takes the other colour.
 */
export function openPuzzle(puzzle: Puzzle): Partial<PuzzleStoreProps> {
	const position = ChessFen.parse(puzzle.fen);
	const playerColor: PieceColor = 'white' === position.turn ? 'black' : 'white';

	return {
		...startLine(position),
		playerColor,
		orientation: playerColor,
		outcome: 'opening',
		result: undefined,
		freePlay: undefined,
		mistakeCount: 0,
		isReplaying: true,
		isRevealing: false,
		isRevealed: false,
	};
}

export function anchorFreePlay(state: LineState, deviation: number | undefined): FreePlayAnchor {
	return { positions: state.positions, line: state.line, cursor: state.cursor, deviation };
}

/** The slice a rewind has to look at to know whether the board is about to jump. */
type RewindState = Pick<PuzzleStoreProps, 'cursor' | 'transition'>;

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

/** Puts the line back exactly where free play picked it up, and nothing in flight. */
export function restoreFreePlayPatch(
	state: RewindState,
	anchor: FreePlayAnchor,
): Partial<PuzzleStoreProps> {
	return {
		positions: anchor.positions,
		line: anchor.line,
		cursor: anchor.cursor,
		freePlay: undefined,
		announced: undefined,
		selected: undefined,
		pendingPromotion: undefined,
		isReplaying: false,
		transition: keptTransition(state, anchor.cursor),
	};
}

/**
 * Puts the line back where it stopped following the script, dropping the moves that
 * strayed, so the solution can be played out from there.
 */
export function revealPatch(
	state: LineState & Pick<PuzzleStoreProps, 'transition'>,
	deviation: number | undefined,
): Partial<PuzzleStoreProps> {
	const cursor = Math.min(state.cursor, deviation ?? state.cursor);

	return {
		cursor,
		line: state.line.slice(0, cursor),
		positions: state.positions.slice(0, cursor + 1),
		announced: undefined,
		selected: undefined,
		pendingPromotion: undefined,
		transition: keptTransition(state, cursor),
		isRevealing: true,
		isRevealed: true,
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

/** Appends a move to the line, dropping anything the cursor had rewound past. */
export function extendLine(state: LineState, move: PuzzleMove, next: ChessPosition): LineState {
	const positions = [...state.positions.slice(0, state.cursor + 1), next];
	const line = [...state.line.slice(0, state.cursor), move];

	return { positions, line, cursor: line.length };
}

/** State patch for a move that has been accepted into the line. */
export function commitPatch(
	state: LineState,
	position: ChessPosition,
	move: ChessMove,
	isOpponent: boolean,
): Partial<PuzzleStoreProps> {
	return {
		...extendLine(state, toRecord(position, move, isOpponent), ChessBoard.apply(position, move)),
		selected: undefined,
		pendingPromotion: undefined,
		transition: nextTransition(move, 'played'),
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

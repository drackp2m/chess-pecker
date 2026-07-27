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
	PuzzleAttempt,
	PuzzleMove,
	PuzzleOutcome,
	PuzzleProgress,
} from '@app/definition/puzzle.type';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessNotation } from '@app/util/chess/chess-notation';

export interface PuzzleStoreProps {
	/** `positions[k]` is the position after `k` moves of the line; `[0]` is the FEN. */
	positions: ChessPosition[];
	/** Correct moves only. A refuted attempt never enters the line. */
	line: PuzzleMove[];
	/** Which position is on screen: `0` … `line.length`. */
	cursor: number;
	attempt: PuzzleAttempt | undefined;
	/** The opponent's scripted move, lit up before it is replayed. */
	announced: ChessMove | undefined;
	/** What the board last did, for the animation policy to judge. */
	transition: BoardTransition | undefined;
	playerColor: PieceColor;
	orientation: PieceColor;
	selected: Square | undefined;
	pendingPromotion: PendingPromotion | undefined;
	outcome: PuzzleOutcome;
	isReplaying: boolean;
}

/** The slice of state that describes the played line. */
export type LineState = Pick<PuzzleStoreProps, 'positions' | 'line' | 'cursor'>;

export function buildPuzzleState(): PuzzleStoreProps {
	return {
		positions: [ChessFen.initial()],
		line: [],
		cursor: 0,
		attempt: undefined,
		announced: undefined,
		transition: undefined,
		playerColor: 'white',
		orientation: 'white',
		selected: undefined,
		pendingPromotion: undefined,
		outcome: 'idle',
		isReplaying: false,
	};
}

/**
 * Opens an exercise at its raw FEN. The side to move there is the opponent — it is
 * about to play `moves[0]` — so the player takes the other colour.
 */
export function openPuzzle(puzzle: Puzzle): Partial<PuzzleStoreProps> {
	const position = ChessFen.parse(puzzle.fen);
	const playerColor: PieceColor = 'white' === position.turn ? 'black' : 'white';

	return {
		positions: [position],
		line: [],
		cursor: 0,
		attempt: undefined,
		announced: undefined,
		transition: undefined,
		playerColor,
		orientation: playerColor,
		selected: undefined,
		pendingPromotion: undefined,
		outcome: 'opening',
		isReplaying: true,
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

	return 'checkmate' === ChessMoveGenerator.status(ChessBoard.apply(position, move));
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
		attempt: undefined,
		selected: undefined,
		pendingPromotion: undefined,
	};
}

/** Player moves found so far; the opponent's plies occupy the even indexes. */
export function describeProgress(
	cursor: number,
	puzzle: Puzzle | undefined,
	playerColor: PieceColor,
): PuzzleProgress {
	return {
		solvedMoves: Math.floor(cursor / 2),
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

/** Which square the click selects, or `undefined` to clear the selection. */
export function nextSelection(
	position: ChessPosition,
	square: Square,
	selected: Square | undefined,
	playerColor: PieceColor,
): Square | undefined {
	const isOwnPiece = ChessBoard.pieceAt(position, square)?.color === playerColor;

	return isOwnPiece && square !== selected ? square : undefined;
}

/** Records a refuted attempt so the board can show it in red before it is taken back. */
export function buildAttempt(position: ChessPosition, move: ChessMove): PuzzleAttempt {
	return {
		move: toRecord(position, move, false),
		position: ChessBoard.apply(position, move),
	};
}

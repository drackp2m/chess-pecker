import { ChessPosition, PieceColor } from '@app/definition/chess.type';
import { Puzzle, PuzzleEvent, PuzzleRecord } from '@app/definition/puzzle.type';
import { HINT, RESTART } from '@app/page/puzzle/store/puzzle/record';
import {
	FreePlayAnchor,
	LineState,
	RevealedLine,
	anchorFreePlay,
	findDeviation,
	toRecord,
} from '@app/page/puzzle/store/puzzle/session';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessNotation } from '@app/util/chess/chess-notation';

export interface FreePlayFold extends LineState {
	readonly anchor: FreePlayAnchor;
}

/**
 * What a restart stands the board back up as: the main line itself, or inside a free-play run
 * the line the sandbox hangs off, cut back to where the script stopped being followed.
 */
function restartFloor(state: LineState, floor: LineState | undefined): LineState {
	const plies = floor?.line.length ?? state.line.length;

	return {
		positions: (floor ?? state).positions.slice(0, plies + 1),
		line: (floor ?? state).line.slice(0, plies),
		cursor: Math.min(1, plies),
	};
}

/**
 * One event of a record played back onto a board. A `0` is a restart, which walks the cursor
 * back without unwriting anything; the hint marker moves nothing at all.
 */
function foldStep(
	state: LineState,
	event: PuzzleEvent,
	opponent: PieceColor,
	floor?: LineState,
): LineState {
	if (HINT === event) {
		return state;
	}

	if ('number' === typeof event) {
		return RESTART === event
			? restartFloor(state, floor)
			: { ...state, cursor: state.cursor + event };
	}

	const position = state.positions[state.cursor];
	const move = undefined === position ? undefined : ChessNotation.parse(position, event);

	if (undefined === position || undefined === move) {
		throw new SyntaxError(`the record does not replay: ${event} at ply ${state.cursor.toString()}`);
	}

	return {
		positions: [...state.positions.slice(0, state.cursor + 1), ChessBoard.apply(position, move)],
		line: [
			...state.line.slice(0, state.cursor),
			toRecord(position, move, position.turn === opponent),
		],
		cursor: state.cursor + 1,
	};
}

function foldEvents(
	state: LineState,
	events: readonly PuzzleEvent[],
	opponent: PieceColor,
	floor?: LineState,
): LineState {
	return events.reduce((current, event) => foldStep(current, event, opponent, floor), state);
}

function startLine(position: ChessPosition): LineState {
	return { positions: [position], line: [], cursor: 0 };
}

export function foldRecord(fen: string, events: readonly PuzzleEvent[]): LineState {
	const position = ChessFen.parse(fen);

	return foldEvents(startLine(position), events, position.turn);
}

/**
 * The answer played out onto a line the closed record can no longer take. Folded from the ply
 * it was anchored to and never from the head, so it stays put while the head walks it.
 */
export function foldRevealed(state: LineState, revealed: RevealedLine | undefined): LineState {
	if (undefined === revealed) {
		return state;
	}

	const stood = { ...state, cursor: Math.min(Math.max(0, revealed.at), state.line.length) };

	if (0 === revealed.moves.length) {
		return stood;
	}

	try {
		return foldEvents(stood, revealed.moves, state.positions[0]?.turn ?? 'white');
	} catch {
		return stood;
	}
}

export function foldOrBlank(fen: string, events: readonly PuzzleEvent[]): LineState {
	try {
		return foldRecord(fen, events);
	} catch {
		return startLine(ChessFen.isValid(fen) ? ChessFen.parse(fen) : ChessFen.initial());
	}
}

/**
 * The line a restart inside the sandbox gives back, cut to where the script stopped being
 * followed. A line the script never broke has nothing to cut off it.
 */
function anchorFloor(anchor: FreePlayAnchor): LineState {
	const plies = anchor.deviation ?? anchor.line.length;

	return {
		positions: anchor.positions.slice(0, plies + 1),
		line: anchor.line.slice(0, plies),
		cursor: anchor.cursor,
	};
}

export function foldFreePlayRun(
	fen: string,
	state: PuzzleRecord,
	index: number,
	puzzle: Puzzle | undefined,
): FreePlayFold | undefined {
	const run = state.freePlayRuns[index];

	if (undefined === run) {
		return undefined;
	}

	const position = ChessFen.parse(fen);
	const entered = foldEvents(startLine(position), state.record.slice(0, run.at), position.turn);
	const anchor = anchorFreePlay(entered, findDeviation(entered, puzzle));

	return {
		...foldEvents(entered, run.events, position.turn, anchorFloor(anchor)),
		anchor,
	};
}

/**
 * The board the log describes: line, positions and cursor come out together because they are
 * one answer. A log that will not replay degrades to the board the exercise opened on.
 */
export function foldSession(
	fen: string,
	state: PuzzleRecord,
	freePlayIndex: number | undefined,
	puzzle: Puzzle | undefined,
): LineState {
	if (undefined === freePlayIndex) {
		return foldOrBlank(fen, state.record);
	}

	try {
		// With no such free-play run, what is left over is the line it would have hung off.
		return foldFreePlayRun(fen, state, freePlayIndex, puzzle) ?? foldOrBlank(fen, state.record);
	} catch {
		return foldOrBlank(fen, state.record);
	}
}

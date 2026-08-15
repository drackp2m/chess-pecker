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

export interface ExplorationFold extends LineState {
	readonly anchor: FreePlayAnchor;
}

/**
 * What a restart stands the board back up as. On the main line it is the line itself:
 * starting over is a way of looking at what was solved, and none of it is unwritten.
 *
 * Inside an exploration it is the main line the sandbox hangs off, cut back to where the
 * exercise stopped following the script — starting the *exercise* over throws the sandbox
 * away, and a move the main line was left standing on was never part of the exercise
 * either. Everything after it goes; only the plies that were really solved are left.
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
 * One event of a record played back onto a board. A `0` is the restart button, which
 * walks the cursor back to the opening move the board plays for itself. On the main line
 * it never unwrites anything, so the plies ahead of the cursor are still there to be
 * stepped through; inside an exploration it gives the main line back. The hint marker
 * moves nothing at all.
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
 * The answer played out onto a line the record has already stopped following. Giving up
 * closes the record, so the plies that follow cannot be written to it; they are still what
 * the board is showing, and this is where they join the line.
 *
 * It is folded from the ply it was anchored to and never from wherever the head is, so it
 * stays put while the head walks it. What it lands on is a stretch of line like any other:
 * the plies it replaces go the way a move played after stepping back sends them.
 *
 * It is the same fold as everything else, so a move that will not replay is dropped along
 * with the rest of the answer rather than taking the solved line down with it — leaving
 * the board standing where the answer was to begin, which is a board that exists.
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
 * The line a restart inside the sandbox gives back: the main line it was entered from, cut
 * to where the exercise stopped following the script. A whole line is one the script never
 * broke, and there is nothing to cut off it.
 */
function anchorFloor(anchor: FreePlayAnchor): LineState {
	const plies = anchor.deviation ?? anchor.line.length;

	return {
		positions: anchor.positions.slice(0, plies + 1),
		line: anchor.line.slice(0, plies),
		cursor: anchor.cursor,
	};
}

export function foldExploration(
	fen: string,
	state: PuzzleRecord,
	index: number,
	puzzle: Puzzle | undefined,
): ExplorationFold | undefined {
	const run = state.explorations[index];

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
 * The board the log describes right now: the exploration standing open, or the main line
 * when none is. It is the whole of the derivation — the line, the positions behind it and
 * the cursor all come out of here together, because they are one answer and not three.
 *
 * A log that does not replay degrades to the board the exercise opened on rather than
 * taking the exercise down with it, which is the same bargain `foldOrBlank` strikes.
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
		// The sandbox is folded the one way there is to fold one, floor and all; what is
		// left over when there is no such exploration is the line it would hang off.
		return foldExploration(fen, state, freePlayIndex, puzzle) ?? foldOrBlank(fen, state.record);
	} catch {
		return foldOrBlank(fen, state.record);
	}
}

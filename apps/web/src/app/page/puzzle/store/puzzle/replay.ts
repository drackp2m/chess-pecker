import { ChessPosition, PieceColor } from '@app/definition/chess.type';
import { Puzzle, PuzzleEvent, PuzzleRecord } from '@app/definition/puzzle.type';
import { HINT, RESTART } from '@app/page/puzzle/store/puzzle/record';
import {
	FreePlayAnchor,
	LineState,
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
 * One event of a record played back onto a board. A `0` is the restart button, which
 * walks the cursor back to the opening move the board plays for itself — it never
 * unwrites the line, so the plies ahead of the cursor are still there to be stepped
 * through. The hint marker moves nothing at all.
 */
function foldStep(state: LineState, event: PuzzleEvent, opponent: PieceColor): LineState {
	if (HINT === event) {
		return state;
	}

	if ('number' === typeof event) {
		const cursor = RESTART === event ? Math.min(1, state.line.length) : state.cursor + event;

		return { ...state, cursor };
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
): LineState {
	return events.reduce((current, event) => foldStep(current, event, opponent), state);
}

function startLine(position: ChessPosition): LineState {
	return { positions: [position], line: [], cursor: 0 };
}

export function foldRecord(fen: string, events: readonly PuzzleEvent[]): LineState {
	const position = ChessFen.parse(fen);

	return foldEvents(startLine(position), events, position.turn);
}

export function foldOrBlank(fen: string, events: readonly PuzzleEvent[]): LineState {
	try {
		return foldRecord(fen, events);
	} catch {
		return startLine(ChessFen.isValid(fen) ? ChessFen.parse(fen) : ChessFen.initial());
	}
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

	return { ...foldEvents(entered, run.events, position.turn), anchor };
}

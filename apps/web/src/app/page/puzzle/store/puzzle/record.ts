import { ChessMove } from '@app/definition/chess.type';
import { PuzzleClosure, PuzzleEvent, PuzzleRecord } from '@app/definition/puzzle.type';
import { ChessNotation } from '@app/util/chess/chess-notation';

/** What a restart looks like in the record, wherever the board was when it happened. */
const RESTART = 0;

/** What a writer reads: the record so far, where it writes, and whether it still may. */
export interface RecordState extends PuzzleRecord {
	/** The free-play anchor; while one is standing the exploration is the target. */
	readonly freePlay: object | undefined;
	/** How the exercise ended, which closes the record for good. */
	readonly closure: PuzzleClosure;
}

export function blankRecord(): PuzzleRecord {
	return { record: [], explorations: [] };
}

/** The record untouched, for everything that happens once it is closed. */
function keep(state: PuzzleRecord): PuzzleRecord {
	return { record: state.record, explorations: state.explorations };
}

function extend(events: readonly PuzzleEvent[], event: PuzzleEvent): readonly PuzzleEvent[] {
	return [...events, event];
}

/**
 * The steps with one more on the end, joined to the run before it only when both go
 * the same way. Adding up across a change of direction would land on `0`, which the
 * format reads as a restart.
 */
function extendRun(events: readonly PuzzleEvent[], step: number): readonly PuzzleEvent[] {
	const last = events.at(-1);
	const isSameWay = 'number' === typeof last && RESTART !== last && 0 < last === 0 < step;

	return isSameWay ? [...events.slice(0, -1), last + step] : [...events, step];
}

/**
 * Puts whatever `write` appends where the exercise is recording right now: the open
 * exploration while free play is on, the main line otherwise, and nowhere at all once
 * the exercise has been closed. A miss no longer closes anything, so the take-back it
 * schedules, the retries after it and the explorations around them are all in here.
 */
function record(
	state: RecordState,
	write: (events: readonly PuzzleEvent[]) => readonly PuzzleEvent[],
): PuzzleRecord {
	if ('open' !== state.closure) {
		return keep(state);
	}

	if (undefined === state.freePlay) {
		return { record: write(state.record), explorations: state.explorations };
	}

	const open = state.explorations.at(-1);

	// Free play without an exploration to write into is free play entered after the
	// record was closed, which the guard above has already turned away.
	if (undefined === open) {
		return keep(state);
	}

	return {
		record: state.record,
		explorations: [...state.explorations.slice(0, -1), { ...open, events: write(open.events) }],
	};
}

/** A move that reached the board, right or wrong and whichever side played it. */
export function recordMove(state: RecordState, move: ChessMove): PuzzleRecord {
	return record(state, (events) => extend(events, ChessNotation.describeLong(move)));
}

/**
 * A cursor displacement, which is the real one — new cursor minus old — and never a
 * magnitude of zero: a step that moved nothing is not something that happened.
 */
export function recordStep(state: RecordState, step: number): PuzzleRecord {
	return 0 === step ? keep(state) : record(state, (events) => extendRun(events, step));
}

export function recordRestart(state: RecordState): PuzzleRecord {
	return record(state, (events) => extend(events, RESTART));
}

/**
 * A new exploration, anchored to the length the main line had reached. `at` is a length
 * and not an index, so entering before anything at all has happened is plainly `0`.
 */
export function recordEntry(state: RecordState): PuzzleRecord {
	if ('open' !== state.closure) {
		return keep(state);
	}

	return {
		record: state.record,
		explorations: [...state.explorations, { at: state.record.length, events: [] }],
	};
}

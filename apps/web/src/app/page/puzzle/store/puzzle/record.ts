import { ChessMove } from '@app/definition/chess.type';
import { PuzzleClosure, PuzzleEvent, PuzzleRecord } from '@app/definition/puzzle.type';
import { ChessNotation } from '@app/util/chess/chess-notation';

/** What a restart looks like in the record, wherever the board was when it happened. */
export const RESTART = 0;

/**
 * What asking for the themes looks like. A UCI move is two squares and maybe a promotion
 * piece, so this can never be read for one, and replaying a record only has to know that
 * it moves nothing.
 */
export const HINT = '?';

/**
 * What a writer reads: the record so far, where it writes, and whether it still may.
 * `freePlayIndex` is the exploration the writing goes into, which is state and not the
 * folded anchor — the writer has to know where to write without replaying anything.
 */
export interface RecordState extends PuzzleRecord {
	/** Which exploration is open; while one is the target, the main line is not. */
	readonly freePlayIndex: number | undefined;
	/** How the exercise ended, which closes the record for good. */
	readonly closure: PuzzleClosure;
}

/**
 * The one thing that can happen to a record. Every writer used to carry its own guard and
 * its own idea of where to write; there is a single verb now, and what varies between them
 * is only which event they hand it.
 */
export type PuzzleAction =
	| { readonly kind: 'move'; readonly move: ChessMove }
	| { readonly kind: 'step'; readonly step: number }
	| { readonly kind: 'restart' }
	| { readonly kind: 'hint' }
	| { readonly kind: 'entry' };

export function blankRecord(): PuzzleRecord {
	return { record: [], explorations: [] };
}

/** The record untouched, for everything that happens once it is closed. */
function keep(state: PuzzleRecord): PuzzleRecord {
	return { record: state.record, explorations: state.explorations };
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
 * What an action writes onto the events it lands in, or `undefined` for an action that
 * turns out to be nothing at all: a step that moved no ply is not something that happened.
 *
 * Entering free play is not in here. It opens the exploration the rest write into rather
 * than writing into one, so `append` deals with it before a target has been chosen.
 */
function writeAction(
	action: Exclude<PuzzleAction, { kind: 'entry' }>,
): ((events: readonly PuzzleEvent[]) => readonly PuzzleEvent[]) | undefined {
	switch (action.kind) {
		case 'move':
			return (events) => [...events, ChessNotation.describeLong(action.move)];
		case 'step':
			return 0 === action.step ? undefined : (events) => extendRun(events, action.step);
		case 'restart':
			return (events) => [...events, RESTART];
		case 'hint':
			return (events) => [...events, HINT];
	}
}

/**
 * Puts whatever the action writes where the exercise is recording right now: the open
 * exploration while free play is on, the main line otherwise, and nowhere at all once
 * the exercise has been closed. A miss no longer closes anything, so the take-back it
 * schedules, the retries after it and the explorations around them are all in here.
 *
 * Entering free play is the one action that writes outside that rule — it is what opens
 * the exploration the others go into — so it is handled before the target is chosen.
 */
export function append(state: RecordState, action: PuzzleAction): PuzzleRecord {
	if ('open' !== state.closure) {
		return keep(state);
	}

	if ('entry' === action.kind) {
		return {
			record: state.record,
			explorations: [...state.explorations, { at: state.record.length, events: [] }],
		};
	}

	const write = writeAction(action);

	if (undefined === write) {
		return keep(state);
	}

	const index = state.freePlayIndex;

	if (undefined === index) {
		return { record: write(state.record), explorations: state.explorations };
	}

	const open = state.explorations[index];

	// Free play without an exploration to write into is free play entered after the
	// record was closed, which the guard above has already turned away.
	if (undefined === open) {
		return keep(state);
	}

	return {
		record: state.record,
		explorations: state.explorations.map((run, at) =>
			at === index ? { ...run, events: write(run.events) } : run,
		),
	};
}

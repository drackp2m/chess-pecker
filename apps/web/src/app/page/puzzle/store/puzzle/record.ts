import { ChessMove } from '@app/definition/chess.type';
import { PuzzleClosure, PuzzleEvent, PuzzleRecord } from '@app/definition/puzzle.type';
import { ChessNotation } from '@app/util/chess/chess-notation';

/** What a restart looks like in the record, wherever the board was when it happened. */
export const RESTART = 0;

/**
 * What asking for the themes looks like. A UCI move is two squares and maybe a piece, so
 * this can never be read for one; replaying only has to know it moves nothing.
 */
export const HINT = '?';

/**
 * What a writer reads. `freePlayIndex` is state and not the folded anchor: a writer has to
 * know where to write without replaying anything.
 */
export interface RecordState extends PuzzleRecord {
	/** Which exploration is open; while one is the target, the main line is not. */
	readonly freePlayIndex: number | undefined;
	/** How the exercise ended, which closes the record for good. */
	readonly closure: PuzzleClosure;
}

/** The one thing that can happen to a record; writers vary only in the event they hand it. */
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
 * One more step on the end, joined to the run before it only when both go the same way:
 * adding up across a change of direction would land on `0`, which reads as a restart.
 */
function extendRun(events: readonly PuzzleEvent[], step: number): readonly PuzzleEvent[] {
	const last = events.at(-1);
	const isSameWay = 'number' === typeof last && RESTART !== last && 0 < last === 0 < step;

	return isSameWay ? [...events.slice(0, -1), last + step] : [...events, step];
}

/**
 * What an action writes, or `undefined` when it turns out to be nothing at all. Entering free
 * play is not here: it opens the exploration the rest write into, so `append` handles it.
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
 * Writes where the exercise is recording now: the open exploration, the main line otherwise,
 * nowhere once closed. Entering free play opens that target, so it is handled first.
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

	// Free play with nothing to write into was entered after the record closed, already refused.
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

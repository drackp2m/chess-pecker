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
	/** Which free-play run is open; while one is the target, the main line is not. */
	readonly freePlayIndex: number | undefined;
	readonly freePlayScratch: readonly PuzzleEvent[] | undefined;
	/** How the exercise ended, which closes the record for good. */
	readonly closure: PuzzleClosure;
}

export interface RecordWrite extends PuzzleRecord {
	readonly freePlayScratch: readonly PuzzleEvent[] | undefined;
}

/** The one thing that can happen to a record; writers vary only in the event they hand it. */
export type PuzzleAction =
	| { readonly kind: 'move'; readonly move: ChessMove }
	| { readonly kind: 'step'; readonly step: number }
	| { readonly kind: 'restart' }
	| { readonly kind: 'hint' }
	| { readonly kind: 'entry' };

export function blankRecord(): PuzzleRecord {
	return { record: [], freePlayRuns: [] };
}

/** The record untouched, for everything that happens once it is closed. */
function keep(state: RecordState): RecordWrite {
	return {
		record: state.record,
		freePlayRuns: state.freePlayRuns,
		freePlayScratch: state.freePlayScratch,
	};
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
 * play is not here: it opens the free-play run the rest write into, so `append` handles it.
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

function appendClosed(state: RecordState, action: PuzzleAction): RecordWrite {
	const scratch = state.freePlayScratch;

	if (undefined === scratch) {
		return 'entry' === action.kind ? { ...keep(state), freePlayScratch: [] } : keep(state);
	}

	const write = 'entry' === action.kind ? undefined : writeAction(action);

	return undefined === write ? keep(state) : { ...keep(state), freePlayScratch: write(scratch) };
}

/**
 * Writes where the exercise is recording now: the open free-play run, the main line otherwise,
 * the sandbox once closed. Entering free play opens that target, so it is handled first.
 */
export function append(state: RecordState, action: PuzzleAction): RecordWrite {
	if ('open' !== state.closure) {
		return appendClosed(state, action);
	}

	if ('entry' === action.kind) {
		return {
			record: state.record,
			freePlayRuns: [...state.freePlayRuns, { at: state.record.length, events: [] }],
			freePlayScratch: undefined,
		};
	}

	const write = writeAction(action);

	if (undefined === write) {
		return keep(state);
	}

	const index = state.freePlayIndex;

	if (undefined === index) {
		return { ...keep(state), record: write(state.record) };
	}

	const open = state.freePlayRuns[index];

	// Free play with nothing to write into was entered after the record closed, already refused.
	if (undefined === open) {
		return keep(state);
	}

	return {
		...keep(state),
		freePlayRuns: state.freePlayRuns.map((run, at) =>
			at === index ? { ...run, events: write(run.events) } : run,
		),
	};
}

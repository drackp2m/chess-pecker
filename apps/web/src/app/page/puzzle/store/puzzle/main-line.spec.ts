import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { HINT } from '@app/page/puzzle/store/puzzle/record';
import {
	BoardReading,
	FIVE_PLY,
	HEADER,
	HINT_REMAINING,
	HINT_TOTAL,
	LineSnapshot,
	MATE_IN_3,
	MATE_IN_3_FEN,
	REPLAY_TOTAL,
	UNDO_TOTAL,
	createStore,
	describeBoard,
	describeLine,
	lookAway,
	play,
	playFivePlyLine,
	replayRecord,
	sanHistory,
	snapshot,
} from '@app/testing/puzzle-store.harness';

/** The whole solution of `MATE_IN_3`, which is every move the scoresheet ever keeps. */
const SOLUTION = ['Rxf8', 'Rb1+', 'Bd1', 'Rxd1+', 'Rf1', 'Rxf1#'];

const OPENING = ['f1f8'];
/** The opening, plus the hint the player takes before touching a piece. */
const ASKED = [...OPENING, HINT];
/** The five plies of the script as the record writes them, with the hint inside. */
const PLAYED = [...ASKED, 'b2b1', 'b3d1', 'b1d1', 'f8f1'];
const LOOKED_BACK = [...PLAYED, -1];
const RESTARTED = [...LOOKED_BACK, 0];
const REJOINED = [...RESTARTED, 4];
const TRIED_TWICE = [...REJOINED, 'd1d2', -1, 'd1d2', -1];
const INSPECTED = [...TRIED_TWICE, 1];
const TRIED_AGAIN = [...INSPECTED, -1, 'd1d3', -1];
const RESTARTED_AGAIN = [...TRIED_AGAIN, 0];
const REJOINED_AGAIN = [...RESTARTED_AGAIN, 5];

const ALL_CONTROLS = ['restart', 'back', 'forward'] as const;
const NO_FORWARD = ['restart', 'back'] as const;

function board(): PuzzleStore {
	return createStore(`${HEADER}\n${MATE_IN_3}`);
}

/** The scoresheet after `plies` of the solution, plus whatever is standing on the end. */
function seen(plies: number, ...strayed: string[]): string[] {
	return [...SOLUTION.slice(0, plies), ...strayed];
}

/**
 * One press of one control, and everything the board reads afterwards. The walk below
 * is the exercise of the specification, beat by beat, and every one of them is a test:
 * the record so far, the board it stands on, the move that is up, whether a piece may
 * be moved, whether a wrong move is showing, what the scoresheet lists, and which of
 * the three line controls the player can press.
 */
interface Beat {
	readonly press: string;
	readonly act: (store: PuzzleStore) => void;
	readonly reads: BoardReading;
}

const OPEN: Pick<BoardReading, 'mistakes' | 'result' | 'closure' | 'hint'> = {
	mistakes: 0,
	result: undefined,
	closure: 'open',
	hint: 'spent',
};

const MISSED: Pick<BoardReading, 'result' | 'closure' | 'hint'> = {
	result: 'failed',
	closure: 'open',
	hint: 'spent',
};

const WALK: readonly Beat[] = [
	{
		press: 'the exercise opening on its own',
		act: (): void => undefined,
		reads: {
			...OPEN,
			record: OPENING,
			cursor: 1,
			move: 'f1f8',
			canPlay: true,
			mistake: undefined,
			visible: seen(1),
			nav: NO_FORWARD,
			// Help asked for on sight is not help: the button does nothing for half a
			// minute, and pressing it in that time leaves no trace at all.
			hint: 'locked',
		},
	},
	{
		press: 'a long while spent looking at something else',
		act: (store): void => {
			lookAway(store, HINT_TOTAL * 4);
		},
		reads: {
			...OPEN,
			record: OPENING,
			cursor: 1,
			move: 'f1f8',
			canPlay: true,
			mistake: undefined,
			visible: seen(1),
			nav: NO_FORWARD,
			// The clock is the one the attempt's own duration is measured on, and it
			// only runs while the exercise is being looked at. Coming back to a board
			// left in the background finds the hint exactly where it was left.
			hint: 'locked',
		},
	},
	{
		press: 'the half minute the hint is kept behind',
		act: (): void => {
			vi.advanceTimersByTime(HINT_TOTAL);
		},
		reads: {
			...OPEN,
			record: OPENING,
			cursor: 1,
			move: 'f1f8',
			canPlay: true,
			mistake: undefined,
			visible: seen(1),
			nav: NO_FORWARD,
			hint: 'offered',
		},
	},
	{
		press: 'the hint, taken before anything is played',
		act: (store): void => {
			store.useHint();
		},
		reads: {
			...OPEN,
			// It moves nothing, so the board reads exactly as it did — but it is written
			// down, and every index after it counts it.
			record: ASKED,
			cursor: 1,
			move: 'f1f8',
			canPlay: true,
			mistake: undefined,
			visible: seen(1),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'Rb1+',
		act: (store): void => {
			play(store, 'b2', 'b1');
		},
		reads: {
			...OPEN,
			record: [...ASKED, 'b2b1'],
			cursor: 2,
			move: 'b2b1',
			canPlay: false,
			mistake: undefined,
			visible: seen(2),
			nav: ['restart'],
		},
	},
	{
		press: 'the answer Bd1',
		act: (): void => {
			vi.advanceTimersByTime(REPLAY_TOTAL);
		},
		reads: {
			...OPEN,
			record: [...ASKED, 'b2b1', 'b3d1'],
			cursor: 3,
			move: 'b3d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(3),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'Rxd1+',
		act: (store): void => {
			play(store, 'b1', 'd1');
		},
		reads: {
			...OPEN,
			record: [...ASKED, 'b2b1', 'b3d1', 'b1d1'],
			cursor: 4,
			move: 'b1d1',
			canPlay: false,
			mistake: undefined,
			visible: seen(4),
			nav: ['restart'],
		},
	},
	{
		press: 'the answer Rf1',
		act: (): void => {
			vi.advanceTimersByTime(REPLAY_TOTAL);
		},
		reads: {
			...OPEN,
			record: PLAYED,
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'a step back, to look at what the opponent did',
		act: (store): void => {
			store.stepBackward();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			cursor: 4,
			move: 'b1d1',
			canPlay: false,
			mistake: undefined,
			visible: seen(4),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'the restart button',
		act: (store): void => {
			store.restart();
		},
		reads: {
			...OPEN,
			record: RESTARTED,
			cursor: 0,
			move: undefined,
			canPlay: false,
			mistake: undefined,
			visible: [],
			nav: [],
		},
	},
	{
		press: 'the opening move replaying itself',
		act: (): void => {
			vi.advanceTimersByTime(REPLAY_TOTAL);
		},
		reads: {
			...OPEN,
			record: RESTARTED,
			cursor: 1,
			move: 'f1f8',
			canPlay: false,
			mistake: undefined,
			visible: seen(1),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'a step forward, back up the line',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: [...RESTARTED, 1],
			cursor: 2,
			move: 'b2b1',
			canPlay: false,
			mistake: undefined,
			visible: seen(2),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'another step forward',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: [...RESTARTED, 2],
			cursor: 3,
			move: 'b3d1',
			canPlay: false,
			mistake: undefined,
			visible: seen(3),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'another step forward',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: [...RESTARTED, 3],
			cursor: 4,
			move: 'b1d1',
			canPlay: false,
			mistake: undefined,
			visible: seen(4),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'the step forward that reaches Rf1 again',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: REJOINED,
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'Rd2, which is wrong',
		act: (store): void => {
			play(store, 'd1', 'd2');
		},
		reads: {
			...MISSED,
			record: [...REJOINED, 'd1d2'],
			cursor: 6,
			move: 'd1d2',
			canPlay: false,
			mistake: 'd1d2',
			visible: seen(5, 'Rd2'),
			nav: NO_FORWARD,
			mistakes: 1,
		},
	},
	{
		press: 'the take-back the board does on its own',
		act: (): void => {
			vi.advanceTimersByTime(UNDO_TOTAL);
		},
		reads: {
			...MISSED,
			record: [...REJOINED, 'd1d2', -1],
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: ALL_CONTROLS,
			mistakes: 1,
		},
	},
	{
		press: 'Rd2 all over again',
		act: (store): void => {
			play(store, 'd1', 'd2');
		},
		reads: {
			...MISSED,
			record: [...REJOINED, 'd1d2', -1, 'd1d2'],
			cursor: 6,
			move: 'd1d2',
			canPlay: false,
			mistake: 'd1d2',
			visible: seen(5, 'Rd2'),
			nav: NO_FORWARD,
			mistakes: 2,
		},
	},
	{
		press: 'the take-back',
		act: (): void => {
			vi.advanceTimersByTime(UNDO_TOTAL);
		},
		reads: {
			...MISSED,
			record: TRIED_TWICE,
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: ALL_CONTROLS,
			mistakes: 2,
		},
	},
	{
		press: 'a step forward onto the wrong move, to see it',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...MISSED,
			record: INSPECTED,
			cursor: 6,
			move: 'd1d2',
			canPlay: false,
			mistake: 'd1d2',
			visible: seen(5, 'Rd2'),
			nav: NO_FORWARD,
			mistakes: 2,
		},
	},
	{
		press: 'the wait that takes nothing back, because nothing was played',
		act: (): void => {
			vi.advanceTimersByTime(UNDO_TOTAL);
		},
		reads: {
			...MISSED,
			record: INSPECTED,
			cursor: 6,
			move: 'd1d2',
			canPlay: false,
			mistake: 'd1d2',
			visible: seen(5, 'Rd2'),
			nav: NO_FORWARD,
			mistakes: 2,
		},
	},
	{
		press: 'a step back off it',
		act: (store): void => {
			store.stepBackward();
		},
		reads: {
			...MISSED,
			record: [...INSPECTED, -1],
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: ALL_CONTROLS,
			mistakes: 2,
		},
	},
	{
		press: 'Rd3, wrong in a different way',
		act: (store): void => {
			play(store, 'd1', 'd3');
		},
		reads: {
			...MISSED,
			record: [...INSPECTED, -1, 'd1d3'],
			cursor: 6,
			move: 'd1d3',
			canPlay: false,
			mistake: 'd1d3',
			visible: seen(5, 'Rd3'),
			nav: NO_FORWARD,
			mistakes: 3,
		},
	},
	{
		press: 'the take-back',
		act: (): void => {
			vi.advanceTimersByTime(UNDO_TOTAL);
		},
		reads: {
			...MISSED,
			record: TRIED_AGAIN,
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: ALL_CONTROLS,
			mistakes: 3,
		},
	},
	{
		press: 'the restart button, a second time',
		act: (store): void => {
			store.restart();
		},
		reads: {
			...MISSED,
			record: RESTARTED_AGAIN,
			cursor: 0,
			move: undefined,
			canPlay: false,
			mistake: undefined,
			visible: [],
			nav: [],
			mistakes: 3,
		},
	},
	{
		press: 'the opening move replaying itself',
		act: (): void => {
			vi.advanceTimersByTime(REPLAY_TOTAL);
		},
		reads: {
			...MISSED,
			record: RESTARTED_AGAIN,
			cursor: 1,
			move: 'f1f8',
			canPlay: false,
			mistake: undefined,
			visible: seen(1),
			nav: ALL_CONTROLS,
			mistakes: 3,
		},
	},
	{
		press: 'a step forward, back up the line again',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...MISSED,
			record: [...RESTARTED_AGAIN, 1],
			cursor: 2,
			move: 'b2b1',
			canPlay: false,
			mistake: undefined,
			visible: seen(2),
			nav: ALL_CONTROLS,
			mistakes: 3,
		},
	},
	{
		press: 'another step forward',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...MISSED,
			record: [...RESTARTED_AGAIN, 2],
			cursor: 3,
			move: 'b3d1',
			canPlay: false,
			mistake: undefined,
			visible: seen(3),
			nav: ALL_CONTROLS,
			mistakes: 3,
		},
	},
	{
		press: 'another step forward',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...MISSED,
			record: [...RESTARTED_AGAIN, 3],
			cursor: 4,
			move: 'b1d1',
			canPlay: false,
			mistake: undefined,
			visible: seen(4),
			nav: ALL_CONTROLS,
			mistakes: 3,
		},
	},
	{
		press: 'the step forward that reaches Rf1',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...MISSED,
			record: [...RESTARTED_AGAIN, 4],
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: ALL_CONTROLS,
			mistakes: 3,
		},
	},
	{
		press: 'the step forward that walks onto the wrong move again',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...MISSED,
			record: REJOINED_AGAIN,
			cursor: 6,
			move: 'd1d3',
			canPlay: false,
			mistake: 'd1d3',
			visible: seen(5, 'Rd3'),
			nav: NO_FORWARD,
			mistakes: 3,
		},
	},
	{
		press: 'a step back off the wrong move',
		act: (store): void => {
			store.stepBackward();
		},
		reads: {
			...MISSED,
			record: [...REJOINED_AGAIN, -1],
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: ALL_CONTROLS,
			mistakes: 3,
		},
	},
	{
		press: 'Rxf1#, which closes it',
		act: (store): void => {
			play(store, 'd1', 'f1');
		},
		reads: {
			record: [...REJOINED_AGAIN, -1, 'd1f1'],
			cursor: 6,
			move: 'd1f1',
			canPlay: false,
			mistake: undefined,
			visible: seen(6),
			nav: NO_FORWARD,
			hint: 'spent',
			mistakes: 3,
			result: 'failed',
			closure: 'found',
		},
	},
];

function walkTo(store: PuzzleStore, beat: number): void {
	for (const earlier of WALK.slice(0, beat + 1)) {
		earlier.act(store);
	}
}

describe('the main line', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	describe('walked from the first ply to the mate', () => {
		for (const [index, beat] of WALK.entries()) {
			it(`reads right, at beat ${(index + 1).toString()}, after ${beat.press}`, () => {
				const store = board();

				walkTo(store, index);

				expect(describeBoard(store)).toEqual(beat.reads);

				// A board mid-beat is one the record does not describe yet: what it holds
				// is where the beat is going to leave the line, not where it is standing.
				if (!store.isBusy()) {
					expect(replayRecord(MATE_IN_3_FEN, store.record())).toEqual(
						describeLine(snapshot(store)),
					);
				}
			});
		}
	});

	describe('what it refuses', () => {
		it('turns away a move played into the middle of the line', () => {
			const store = board();

			walkTo(
				store,
				WALK.findIndex((beat) => beat.press.startsWith('the opening move')),
			);

			// Rc2 is legal here and is not the solution, so nothing but the gate is
			// stopping it: the line is five plies long and none of them may be dropped.
			play(store, 'b2', 'c2');

			expect(store.line()).toHaveLength(5);
			expect(store.record()).toEqual(RESTARTED);
			expect(store.mistakeCount()).toBe(0);
			expect(store.isLocked()).toBe(true);
		});

		it('gives the line back to the player only at the end of what was solved', () => {
			const store = board();

			playFivePlyLine(store);

			for (const cursor of [4, 3, 2, 1, 0]) {
				store.stepBackward();

				expect(store.cursor()).toBe(cursor);
				expect(store.canPlay()).toBe(false);
			}

			for (const cursor of [1, 2, 3, 4]) {
				store.stepForward();

				expect(store.cursor()).toBe(cursor);
				expect(store.canPlay()).toBe(false);
			}

			store.stepForward();

			expect(store.cursor()).toBe(5);
			expect(store.canPlay()).toBe(true);
		});
	});

	/**
	 * The wait behind the hint is measured the way the attempt's own duration is: only
	 * while the exercise is on screen. Anything else would hand the themes over to a
	 * player who opened the exercise, walked off and came back — which is the one case
	 * the wait exists for.
	 */
	describe('the clock the hint waits on', () => {
		it('counts what was watched, in as many sittings as it takes', () => {
			const store = board();

			vi.advanceTimersByTime(HINT_REMAINING - 1000);

			expect(store.canUseHint()).toBe(false);

			lookAway(store, HINT_TOTAL * 10);

			expect(store.canUseHint()).toBe(false);

			vi.advanceTimersByTime(999);

			expect(store.canUseHint()).toBe(false);

			vi.advanceTimersByTime(1);

			expect(store.canUseHint()).toBe(true);
		});

		it('never runs down on a tab that is never come back to', () => {
			const store = board();

			store.pauseClock();
			vi.advanceTimersByTime(HINT_TOTAL * 100);

			expect(store.canUseHint()).toBe(false);
		});

		it('is not wound back by a tab that says it went away twice over', () => {
			const store = board();

			vi.advanceTimersByTime(HINT_REMAINING - 1);
			store.pauseClock();
			store.pauseClock();
			vi.advanceTimersByTime(HINT_TOTAL);
			store.resumeClock();
			store.resumeClock();

			expect(store.canUseHint()).toBe(false);

			vi.advanceTimersByTime(1);

			expect(store.canUseHint()).toBe(true);
		});
	});

	describe('the restart button', () => {
		it('does not reopen the exercise it takes back to the start', () => {
			const store = board();

			// The walk takes the hint on its way through, and a restart is the same
			// exercise being worked on: what was spent stays spent.
			walkTo(store, WALK.length - 2);
			store.restart();
			vi.advanceTimersByTime(REPLAY_TOTAL);

			expect(store.cursor()).toBe(1);
			expect(store.line()).toHaveLength(6);
			expect(store.hintUsed()).toBe(true);
			expect(store.result()).toBe('failed');
			expect(store.mistakeCount()).toBe(3);
			expect(store.closure()).toBe('open');
		});

		it('writes itself into the record and nothing else, opening move included', () => {
			const store = board();

			playFivePlyLine(store);
			store.restart();

			expect(store.record()).toEqual([...FIVE_PLY, 0]);
			expect(store.isBusy()).toBe(true);

			vi.advanceTimersByTime(REPLAY_TOTAL);

			expect(store.record()).toEqual([...FIVE_PLY, 0]);
			expect(store.cursor()).toBe(1);
		});
	});

	describe('stepping through it', () => {
		it('steps backward and forward without ever destroying the line', () => {
			const store = board();

			play(store, 'b2', 'b1');
			vi.advanceTimersByTime(REPLAY_TOTAL);

			expect(store.cursor()).toBe(3);

			store.stepBackward();
			store.stepBackward();

			expect(store.cursor()).toBe(1);
			expect(sanHistory(store)).toEqual(seen(1));
			expect(store.canStepForward()).toBe(true);

			store.stepForward();

			expect(store.cursor()).toBe(2);
			expect(sanHistory(store)).toEqual(seen(2));
			expect(store.line()).toHaveLength(3);
		});

		it('collapses a run of steps only while it keeps going the same way', () => {
			const store = board();

			playFivePlyLine(store);
			store.stepBackward();
			store.stepBackward();

			expect(store.record()).toEqual([...FIVE_PLY, -2]);

			store.stepForward();

			expect(store.record()).toEqual([...FIVE_PLY, -2, 1]);
		});
	});

	it('replays the main line back into the board each exploration started from', () => {
		const store = board();
		const entries: LineSnapshot[] = [];

		playFivePlyLine(store);
		store.stepBackward();
		store.stepBackward();

		entries.push(snapshot(store));
		store.toggleFreePlay();
		play(store, 'a7', 'a6');
		store.toggleFreePlay();

		store.stepForward();
		store.restart();
		vi.advanceTimersByTime(REPLAY_TOTAL);

		entries.push(snapshot(store));
		store.toggleFreePlay();
		store.toggleFreePlay();

		const anchors = store.explorations().map((run) => run.at);

		expect(store.record()).toEqual([...FIVE_PLY, -2, 1, 0]);
		expect(store.explorations()).toEqual([
			{ at: 6, events: ['a7a6'] },
			{ at: 8, events: [] },
		]);

		for (const [index, entry] of entries.entries()) {
			expect(replayRecord(MATE_IN_3_FEN, store.record().slice(0, anchors[index]))).toEqual(
				describeLine(entry),
			);
		}
	});
});

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FreePlayRun, PuzzleEvent } from '@app/definition/puzzle.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { HINT } from '@app/page/puzzle/store/puzzle/record';
import {
	BoardReading,
	HEADER,
	HINT_REMAINING,
	HINT_TOTAL,
	MATE_IN_3,
	MATE_IN_3_FEN,
	REPLAY_TOTAL,
	UNDO_TOTAL,
	createStore,
	describeBoard,
	describeLine,
	lookAway,
	miss,
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
const THREE_PLY = [...ASKED, 'b2b1', 'b3d1'];
const PLAYED = [...THREE_PLY, 'b1d1', 'f8f1'];
const LOOKED_BACK = [...PLAYED, -3];
const REJOINED = [...LOOKED_BACK, 3];
const MISTAKEN = [...REJOINED, 'd1d3'];
const TAKEN_BACK = [...MISTAKEN, -1];
const REVIEWED = [...TAKEN_BACK, 1];

/**
 * Where each exploration hangs off the main record: the events written at that moment,
 * which is what makes `record.slice(0, at)` the board it was handed.
 */
const ANCHORS = [THREE_PLY.length, LOOKED_BACK.length, REVIEWED.length];

/** The three of them once they are finished, for the beats that read them back. */
const FIRST = [0, -1, 3, 'h5g3', 'h2g3', -2, 'b1d1'];
const SECOND = [3, 0, 4, 'd1d5', 'c5d5'];
const THIRD = [-1, 'd1f1', 0, 4];

const ALL_CONTROLS = ['restart', 'back', 'forward'] as const;
const NO_FORWARD = ['restart', 'back'] as const;
const ONLY_RESTART = ['restart'] as const;
const ONLY_FORWARD = ['forward'] as const;
const NOTHING = [] as const;

function board(): PuzzleStore {
	return createStore(`${HEADER}\n${MATE_IN_3}`);
}

/** The scoresheet after `plies` of the solution, plus whatever is standing on the end. */
function seen(plies: number, ...strayed: string[]): string[] {
	return [...SOLUTION.slice(0, plies), ...strayed];
}

/** The explorations opened so far, each one given the events it holds at this beat. */
function runs(...opened: readonly (readonly PuzzleEvent[])[]): readonly FreePlayRun[] {
	return opened.map((events, index) => ({ at: ANCHORS[index] ?? 0, events }));
}

/**
 * Everything the board reads on the main line, plus the two things only an exploration
 * has to say: whether one is open, and what every one of them has written down.
 */
interface SessionReading extends BoardReading {
	readonly exploring: boolean;
	readonly explorations: readonly FreePlayRun[];
}

function describeSession(store: PuzzleStore): SessionReading {
	return {
		...describeBoard(store),
		exploring: store.isFreePlay(),
		explorations: store.explorations(),
	};
}

/**
 * One press of one control, and everything the board reads afterwards. `record` is what an
 * exploration may never touch, and `explorations` the only place its own moves are kept.
 */
interface Beat {
	readonly press: string;
	readonly act: (store: PuzzleStore) => void;
	readonly reads: SessionReading;
}

const OPEN: Pick<SessionReading, 'mistakes' | 'result' | 'closure' | 'hint'> = {
	mistakes: 0,
	result: undefined,
	closure: 'open',
	hint: 'spent',
};

const MISSED: Pick<SessionReading, 'mistakes' | 'result' | 'closure' | 'hint'> = {
	mistakes: 1,
	result: 'failed',
	closure: 'open',
	hint: 'spent',
};

/** The exercise walked up to Bd1, which is where the player runs out of certainty. */
const APPROACH: readonly Beat[] = [
	{
		press: 'the exercise opening on its own',
		act: (): void => undefined,
		reads: {
			...OPEN,
			record: OPENING,
			exploring: false,
			explorations: runs(),
			cursor: 1,
			move: 'f1f8',
			canPlay: true,
			mistake: undefined,
			visible: seen(1),
			nav: NO_FORWARD,
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
			exploring: false,
			explorations: runs(),
			cursor: 1,
			move: 'f1f8',
			canPlay: true,
			mistake: undefined,
			visible: seen(1),
			nav: NO_FORWARD,
			// The clock is the one the attempt's own duration is measured on, and it
			// only runs while the exercise is being looked at.
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
			exploring: false,
			explorations: runs(),
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
		press: 'the hint, taken on the main line before anything is played',
		act: (store): void => {
			store.useHint();
		},
		reads: {
			...OPEN,
			// It moves nothing, so the board reads exactly as it did. What it does is
			// push every index after it along by one, anchors included.
			record: ASKED,
			exploring: false,
			explorations: runs(),
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
			// The answer is written before it is shown, since a programme only walks line that
			// already exists, so the record runs a ply ahead for as long as the beat lasts.
			record: THREE_PLY,
			exploring: false,
			explorations: runs(),
			cursor: 2,
			move: 'b2b1',
			canPlay: false,
			mistake: undefined,
			visible: seen(2),
			nav: ONLY_RESTART,
		},
	},
	{
		press: 'the answer Bd1',
		act: (): void => {
			vi.advanceTimersByTime(REPLAY_TOTAL);
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: false,
			explorations: runs(),
			cursor: 3,
			move: 'b3d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(3),
			nav: NO_FORWARD,
		},
	},
];

/**
 * The first exploration: the exercise started over from inside it, walked back up to
 * where the main line had got to, and a line tried out there and refuted.
 */
const FIRST_EXPLORATION: readonly Beat[] = [
	{
		press: 'the magnifying glass, which opens an exploration',
		act: (store): void => {
			store.toggleFreePlay();
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: true,
			// The line is inherited whole; the actions that built it are not.
			explorations: runs([]),
			cursor: 3,
			move: 'b3d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(3),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'the restart button, inside the exploration',
		act: (store): void => {
			store.restart();
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: true,
			explorations: runs([0]),
			cursor: 0,
			move: undefined,
			canPlay: false,
			mistake: undefined,
			visible: [],
			nav: NOTHING,
		},
	},
	{
		press: 'the opening move being shown again',
		act: (): void => {
			vi.advanceTimersByTime(REPLAY_TOTAL);
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: true,
			// Shown, not played: the line was already holding it, so there is nothing to
			// write down but the restart itself.
			explorations: runs([0]),
			cursor: 1,
			move: 'f1f8',
			canPlay: true,
			mistake: undefined,
			visible: seen(1),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'a step back, onto the board the exercise opened on',
		act: (store): void => {
			store.stepBackward();
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: true,
			explorations: runs([0, -1]),
			cursor: 0,
			move: undefined,
			canPlay: true,
			mistake: undefined,
			visible: [],
			nav: ONLY_FORWARD,
		},
	},
	{
		press: 'a step forward',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: true,
			explorations: runs([0, -1, 1]),
			cursor: 1,
			move: 'f1f8',
			canPlay: true,
			mistake: undefined,
			visible: seen(1),
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
			record: THREE_PLY,
			exploring: true,
			explorations: runs([0, -1, 2]),
			cursor: 2,
			move: 'b2b1',
			canPlay: true,
			mistake: undefined,
			visible: seen(2),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'the step forward that reaches the end of the inherited line',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: true,
			explorations: runs([0, -1, 3]),
			cursor: 3,
			move: 'b3d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(3),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'Ng3+, which is nothing the script has ever heard of',
		act: (store): void => {
			play(store, 'h5', 'g3');
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: true,
			explorations: runs([0, -1, 3, 'h5g3']),
			cursor: 4,
			move: 'h5g3',
			canPlay: true,
			mistake: undefined,
			visible: seen(3, 'Ng3+'),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'hxg3, the refutation, played by the player on the opponent’s behalf',
		act: (store): void => {
			play(store, 'h2', 'g3');
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: true,
			explorations: runs([0, -1, 3, 'h5g3', 'h2g3']),
			cursor: 5,
			move: 'h2g3',
			canPlay: true,
			mistake: undefined,
			visible: seen(3, 'Ng3+', 'hxg3'),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'a step back off the refutation',
		act: (store): void => {
			store.stepBackward();
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: true,
			explorations: runs([0, -1, 3, 'h5g3', 'h2g3', -1]),
			cursor: 4,
			move: 'h5g3',
			canPlay: true,
			mistake: undefined,
			visible: seen(3, 'Ng3+'),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'another step back, off Ng3+ with it',
		act: (store): void => {
			store.stepBackward();
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: true,
			explorations: runs([0, -1, 3, 'h5g3', 'h2g3', -2]),
			cursor: 3,
			move: 'b3d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(3),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'Rxd1+, which does hold up',
		act: (store): void => {
			play(store, 'b1', 'd1');
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: true,
			explorations: runs(FIRST),
			cursor: 4,
			move: 'b1d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(4),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'the magnifying glass again, which closes the exploration',
		act: (store): void => {
			store.toggleFreePlay();
		},
		reads: {
			...OPEN,
			record: THREE_PLY,
			exploring: false,
			explorations: runs(FIRST),
			cursor: 3,
			move: 'b3d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(3),
			nav: NO_FORWARD,
		},
	},
];

/** Rxd1+ for real, the answer to it, and a look back over the last three plies. */
const CONTINUED: readonly Beat[] = [
	{
		press: 'Rxd1+ on the main line',
		act: (store): void => {
			play(store, 'b1', 'd1');
		},
		reads: {
			...OPEN,
			// A ply ahead again, for as long as the answer takes to arrive.
			record: PLAYED,
			exploring: false,
			explorations: runs(FIRST),
			cursor: 4,
			move: 'b1d1',
			canPlay: false,
			mistake: undefined,
			visible: seen(4),
			nav: ONLY_RESTART,
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
			exploring: false,
			explorations: runs(FIRST),
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'a step back',
		act: (store): void => {
			store.stepBackward();
		},
		reads: {
			...OPEN,
			record: [...PLAYED, -1],
			exploring: false,
			explorations: runs(FIRST),
			cursor: 4,
			move: 'b1d1',
			canPlay: false,
			mistake: undefined,
			visible: seen(4),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'another step back',
		act: (store): void => {
			store.stepBackward();
		},
		reads: {
			...OPEN,
			record: [...PLAYED, -2],
			exploring: false,
			explorations: runs(FIRST),
			cursor: 3,
			move: 'b3d1',
			canPlay: false,
			mistake: undefined,
			visible: seen(3),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'a third step back',
		act: (store): void => {
			store.stepBackward();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: false,
			explorations: runs(FIRST),
			cursor: 2,
			move: 'b2b1',
			canPlay: false,
			mistake: undefined,
			visible: seen(2),
			nav: ALL_CONTROLS,
		},
	},
];

/**
 * The second exploration, entered three plies behind what the exercise had reached: the
 * restart gives back the whole main line, not the ply the cursor was resting on.
 */
const SECOND_EXPLORATION: readonly Beat[] = [
	{
		press: 'the magnifying glass, a second time, from three plies back',
		act: (store): void => {
			store.toggleFreePlay();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			// Anchored to everything the main line has written by now — the looking back
			// included — and not to the ply the cursor is standing on.
			explorations: runs(FIRST, []),
			cursor: 2,
			// The main line refuses a move here; the sandbox does not.
			canPlay: true,
			move: 'b2b1',
			mistake: undefined,
			visible: seen(2),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'a step forward inside it',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			explorations: runs(FIRST, [1]),
			cursor: 3,
			move: 'b3d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(3),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'another step forward inside it',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			explorations: runs(FIRST, [2]),
			cursor: 4,
			move: 'b1d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(4),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'the step forward that catches up with the exercise',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			explorations: runs(FIRST, [3]),
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'the restart button, from a sandbox that had caught up',
		act: (store): void => {
			store.restart();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			explorations: runs(FIRST, [3, 0]),
			cursor: 0,
			move: undefined,
			canPlay: false,
			mistake: undefined,
			visible: [],
			nav: NOTHING,
		},
	},
	{
		press: 'the opening move being shown again, a second time',
		act: (): void => {
			vi.advanceTimersByTime(REPLAY_TOTAL);
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			explorations: runs(FIRST, [3, 0]),
			cursor: 1,
			move: 'f1f8',
			canPlay: true,
			mistake: undefined,
			visible: seen(1),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'a step forward after the restart',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			explorations: runs(FIRST, [3, 0, 1]),
			cursor: 2,
			move: 'b2b1',
			canPlay: true,
			mistake: undefined,
			visible: seen(2),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'another step forward after the restart',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			explorations: runs(FIRST, [3, 0, 2]),
			cursor: 3,
			move: 'b3d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(3),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'a third step forward after the restart',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			explorations: runs(FIRST, [3, 0, 3]),
			cursor: 4,
			move: 'b1d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(4),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'the fourth step forward, which is the whole main line again',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			// Four presses, not three: the restart handed back everything the exercise
			// had reached, and not the two plies the cursor was resting behind.
			explorations: runs(FIRST, [3, 0, 4]),
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'Rd5, which looks like something',
		act: (store): void => {
			play(store, 'd1', 'd5');
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			explorations: runs(FIRST, [3, 0, 4, 'd1d5']),
			cursor: 6,
			move: 'd1d5',
			canPlay: true,
			mistake: undefined,
			visible: seen(5, 'Rd5'),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'Rxd5, which is why it was not',
		act: (store): void => {
			play(store, 'c5', 'd5');
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: true,
			explorations: runs(FIRST, SECOND),
			cursor: 7,
			move: 'c5d5',
			canPlay: true,
			mistake: undefined,
			visible: seen(5, 'Rd5', 'Rxd5'),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'the way out, having thought better of it',
		act: (store): void => {
			store.toggleFreePlay();
		},
		reads: {
			...OPEN,
			record: LOOKED_BACK,
			exploring: false,
			explorations: runs(FIRST, SECOND),
			// Everything the sandbox did is undone at a stroke, cursor included: the main
			// line is exactly three plies back, where it was left.
			cursor: 2,
			move: 'b2b1',
			canPlay: false,
			mistake: undefined,
			visible: seen(2),
			nav: ALL_CONTROLS,
		},
	},
];

/** Back up the main line, the miss that follows, and the look the player takes at it. */
const MISS: readonly Beat[] = [
	{
		press: 'a step forward on the main line',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: [...LOOKED_BACK, 1],
			exploring: false,
			explorations: runs(FIRST, SECOND),
			cursor: 3,
			move: 'b3d1',
			canPlay: false,
			mistake: undefined,
			visible: seen(3),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'another step forward on the main line',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...OPEN,
			record: [...LOOKED_BACK, 2],
			exploring: false,
			explorations: runs(FIRST, SECOND),
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
			exploring: false,
			explorations: runs(FIRST, SECOND),
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'Rd3, which is wrong',
		act: (store): void => {
			play(store, 'd1', 'd3');
		},
		reads: {
			...MISSED,
			record: MISTAKEN,
			exploring: false,
			explorations: runs(FIRST, SECOND),
			cursor: 6,
			move: 'd1d3',
			canPlay: false,
			mistake: 'd1d3',
			visible: seen(5, 'Rd3'),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'the take-back the board does on its own',
		act: (): void => {
			vi.advanceTimersByTime(UNDO_TOTAL);
		},
		reads: {
			...MISSED,
			record: TAKEN_BACK,
			exploring: false,
			explorations: runs(FIRST, SECOND),
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'a step forward onto the wrong move, to look at it',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...MISSED,
			record: REVIEWED,
			exploring: false,
			explorations: runs(FIRST, SECOND),
			cursor: 6,
			move: 'd1d3',
			canPlay: false,
			mistake: 'd1d3',
			visible: seen(5, 'Rd3'),
			nav: NO_FORWARD,
		},
	},
];

/**
 * The third exploration: entered on a refuted board and restarted from inside, which throws
 * the sandbox away and the wrong move with it.
 */
const THIRD_EXPLORATION: readonly Beat[] = [
	{
		press: 'the magnifying glass, a third time',
		act: (store): void => {
			store.toggleFreePlay();
		},
		reads: {
			...MISSED,
			record: REVIEWED,
			exploring: true,
			explorations: runs(FIRST, SECOND, []),
			cursor: 6,
			move: 'd1d3',
			canPlay: true,
			// Rd3 is still on the board, but nothing inside an exploration is graded
			// against the script, so nothing in here is called a mistake.
			mistake: undefined,
			visible: seen(5, 'Rd3'),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'a step back off the wrong move',
		act: (store): void => {
			store.stepBackward();
		},
		reads: {
			...MISSED,
			record: REVIEWED,
			exploring: true,
			explorations: runs(FIRST, SECOND, [-1]),
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'Rxf1#, the move the exercise was after all along',
		act: (store): void => {
			play(store, 'd1', 'f1');
		},
		reads: {
			...MISSED,
			record: REVIEWED,
			exploring: true,
			explorations: runs(FIRST, SECOND, [-1, 'd1f1']),
			cursor: 6,
			move: 'd1f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(6),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'the restart button, from inside the exploration',
		act: (store): void => {
			store.restart();
		},
		reads: {
			...MISSED,
			record: REVIEWED,
			exploring: true,
			explorations: runs(FIRST, SECOND, [-1, 'd1f1', 0]),
			cursor: 0,
			move: undefined,
			canPlay: false,
			mistake: undefined,
			visible: [],
			nav: NOTHING,
		},
	},
	{
		press: 'the opening move being shown again, a third time',
		act: (): void => {
			vi.advanceTimersByTime(REPLAY_TOTAL);
		},
		reads: {
			...MISSED,
			record: REVIEWED,
			exploring: true,
			explorations: runs(FIRST, SECOND, [-1, 'd1f1', 0]),
			cursor: 1,
			move: 'f1f8',
			canPlay: true,
			mistake: undefined,
			visible: seen(1),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'a step forward, back up the main line',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...MISSED,
			record: REVIEWED,
			exploring: true,
			explorations: runs(FIRST, SECOND, [-1, 'd1f1', 0, 1]),
			cursor: 2,
			move: 'b2b1',
			canPlay: true,
			mistake: undefined,
			visible: seen(2),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'another step forward, back up the main line',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...MISSED,
			record: REVIEWED,
			exploring: true,
			explorations: runs(FIRST, SECOND, [-1, 'd1f1', 0, 2]),
			cursor: 3,
			move: 'b3d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(3),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'a third step forward, back up the main line',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...MISSED,
			record: REVIEWED,
			exploring: true,
			explorations: runs(FIRST, SECOND, [-1, 'd1f1', 0, 3]),
			cursor: 4,
			move: 'b1d1',
			canPlay: true,
			mistake: undefined,
			visible: seen(4),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'the fourth and last step forward the line has left',
		act: (store): void => {
			store.stepForward();
		},
		reads: {
			...MISSED,
			record: REVIEWED,
			exploring: true,
			// Rxf1# was the sandbox's and went with it; Rd3 was never the exercise's, so
			// five plies is everything there is left to walk.
			explorations: runs(FIRST, SECOND, THIRD),
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: NO_FORWARD,
		},
	},
	{
		press: 'the way out, with the main line waiting exactly where it was left',
		act: (store): void => {
			store.toggleFreePlay();
		},
		reads: {
			...MISSED,
			record: REVIEWED,
			exploring: false,
			explorations: runs(FIRST, SECOND, THIRD),
			cursor: 6,
			move: 'd1d3',
			canPlay: false,
			// Out here it is a mistake again, and the same one it always was.
			mistake: 'd1d3',
			visible: seen(5, 'Rd3'),
			nav: NO_FORWARD,
		},
	},
];

/** What the third exploration was for: the move, played where it counts. */
const CLOSE: readonly Beat[] = [
	{
		press: 'a step back off the wrong move, for the last time',
		act: (store): void => {
			store.stepBackward();
		},
		reads: {
			...MISSED,
			record: [...REVIEWED, -1],
			exploring: false,
			explorations: runs(FIRST, SECOND, THIRD),
			cursor: 5,
			move: 'f8f1',
			canPlay: true,
			mistake: undefined,
			visible: seen(5),
			nav: ALL_CONTROLS,
		},
	},
	{
		press: 'Rxf1#, which closes it',
		act: (store): void => {
			play(store, 'd1', 'f1');
		},
		reads: {
			...MISSED,
			record: [...REVIEWED, -1, 'd1f1'],
			exploring: false,
			explorations: runs(FIRST, SECOND, THIRD),
			cursor: 6,
			move: 'd1f1',
			canPlay: false,
			mistake: undefined,
			visible: seen(6),
			nav: NO_FORWARD,
			closure: 'found',
		},
	},
];

const WALK: readonly Beat[] = [
	...APPROACH,
	...FIRST_EXPLORATION,
	...CONTINUED,
	...SECOND_EXPLORATION,
	...MISS,
	...THIRD_EXPLORATION,
	...CLOSE,
];

function walkTo(store: PuzzleStore, beat: number): void {
	for (const earlier of WALK.slice(0, beat + 1)) {
		earlier.act(store);
	}
}

function beatAt(press: string): number {
	return WALK.findIndex((beat) => beat.press.startsWith(press));
}

/** The board an exploration describes: the main line up to its anchor, then its events. */
function replayExploration(store: PuzzleStore, index: number) {
	const run = store.explorations()[index] ?? { at: 0, events: [] };

	return replayRecord(MATE_IN_3_FEN, [...store.record().slice(0, run.at), ...run.events]);
}

describe('the exploration mode', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	describe('walked through three visits to the sandbox and back', () => {
		for (const [index, beat] of WALK.entries()) {
			it(`reads right, at beat ${(index + 1).toString()}, after ${beat.press}`, () => {
				const store = board();

				walkTo(store, index);

				expect(describeSession(store)).toEqual(beat.reads);

				// The main record only ever describes the main board: inside an exploration, the
				// one waiting to be returned to, and mid-beat, where the beat is going.
				if (!store.isFreePlay() && !store.isBusy()) {
					expect(replayRecord(MATE_IN_3_FEN, store.record())).toEqual(
						describeLine(snapshot(store)),
					);
				}
			});
		}
	});

	describe('what it inherits', () => {
		it('takes the line the main one was showing and none of how it got there', () => {
			const store = board();

			walkTo(store, beatAt('the answer Bd1'));

			const entry = snapshot(store);
			const record = store.record();

			store.toggleFreePlay();

			expect(store.explorations()).toEqual([{ at: record.length, events: [] }]);
			expect(snapshot(store)).toEqual(entry);
			expect(store.record()).toEqual(record);
		});

		it('lets the opponent be played on their own turn, which the main line never does', () => {
			const store = board();

			playFivePlyLine(store);

			// Back to the board the exercise opened on, the one White turn that is not an answer
			// to a check, so they have a move of their own to play.
			for (const cursor of [4, 3, 2, 1, 0]) {
				store.stepBackward();

				expect(store.cursor()).toBe(cursor);
			}

			expect(store.canPlay()).toBe(false);

			store.toggleFreePlay();

			expect(store.position().turn).not.toBe(store.playerColor());
			expect(store.canPlay()).toBe(true);

			play(store, 'a2', 'a3');

			expect(store.cursor()).toBe(1);
			expect(sanHistory(store)).toEqual(['a3']);
			expect(store.explorations()).toEqual([{ at: 6, events: ['a2a3'] }]);
		});
	});

	describe('the restart button inside it', () => {
		it('gives back the main line, without the move the exercise was missed on', () => {
			const store = board();

			walkTo(store, beatAt('Rxf1#, the move'));

			expect(store.line()).toHaveLength(6);

			store.restart();
			vi.advanceTimersByTime(REPLAY_TOTAL);

			// Rxf1# belonged to the sandbox and Rd3 never belonged to the exercise, so
			// what is left to walk is the five plies that were really solved.
			expect(store.isFreePlay()).toBe(true);
			expect(store.cursor()).toBe(1);
			expect(store.line()).toHaveLength(5);

			for (const cursor of [2, 3, 4, 5]) {
				store.stepForward();

				expect(store.cursor()).toBe(cursor);
			}

			store.stepForward();

			expect(store.cursor()).toBe(5);
			expect(sanHistory(store)).toEqual(seen(5));
		});

		it('leaves the main line where the exploration found it, restart and all', () => {
			const store = board();

			walkTo(store, beatAt('a third step back'));

			const entry = snapshot(store);
			const record = store.record();

			store.toggleFreePlay();
			store.restart();
			vi.advanceTimersByTime(REPLAY_TOTAL);
			play(store, 'b2', 'c2');
			store.toggleFreePlay();

			expect(snapshot(store)).toEqual(entry);
			expect(store.record()).toEqual(record);
			expect(store.explorations().at(-1)).toEqual({
				at: record.length,
				events: [0, 'b2c2'],
			});
		});
	});

	describe('what it never grades', () => {
		it('calls no move of its own a mistake, and shows the check one gives', () => {
			const store = board();

			walkTo(store, beatAt('Ng3+'));

			// Ng3+ is a blunder by any measure and the script has never heard of it. The
			// check is the board's own business and shows; the verdict is not and does not.
			expect(store.checkedSquare()).toBe('h1');
			expect(store.mistake()).toBeUndefined();
			expect(store.result()).toBeUndefined();
			expect(store.mistakeCount()).toBe(0);
		});

		it('hides the mistake the main line is standing on, and gives it back on the way out', () => {
			const store = board();

			walkTo(store, beatAt('the magnifying glass, a third time'));

			expect(store.mistake()).toBeUndefined();

			store.stepBackward();
			play(store, 'd1', 'f1');

			// Mate is the board's own too, and an exploration is a real game on it.
			expect(store.freePlayStatus()).toBe('checkmate');
			expect(store.checkedSquare()).toBe('h1');
			expect(store.mistake()).toBeUndefined();
			expect(store.result()).toBe('failed');

			store.toggleFreePlay();

			expect(store.mistake()?.to).toBe('d3');
		});

		it('drops a take-back that was still pending when it was opened', () => {
			const store = board();

			miss(store);
			store.toggleFreePlay();
			vi.advanceTimersByTime(UNDO_TOTAL);

			// There is no mistake in here to take back, so the sandbox is left alone —
			// a rewind of the main line has no business moving it, or writing into it.
			expect(store.cursor()).toBe(2);
			expect(store.explorations()).toEqual([{ at: 2, events: [] }]);

			store.toggleFreePlay();

			// Outside it is a mistake again. Stepping off it is the player's to do now.
			expect(store.cursor()).toBe(2);
			expect(store.mistake()?.to).toBe('c2');
			expect(store.canStepBackward()).toBe(true);
		});
	});

	describe('the hint', () => {
		it('stays behind its clock inside an exploration, and is written into it', () => {
			const store = board();

			store.toggleFreePlay();
			store.useHint();

			expect(store.hintUsed()).toBe(false);
			expect(store.explorations()).toEqual([{ at: 1, events: [] }]);

			vi.advanceTimersByTime(HINT_TOTAL);
			store.useHint();
			store.toggleFreePlay();

			// Where it was written is the whole answer to where it was asked for.
			expect(store.hintUsed()).toBe(true);
			expect(store.record()).toEqual(OPENING);
			expect(store.explorations()).toEqual([{ at: 1, events: [HINT] }]);
		});

		/**
		 * A sandbox is the exercise being worked on, so the hint's clock runs inside one — and
		 * stops for the same reason it stops anywhere else.
		 */
		it('runs on inside an exploration, and stops with the tab there too', () => {
			const store = board();

			store.toggleFreePlay();
			vi.advanceTimersByTime(HINT_REMAINING - 1000);
			lookAway(store, HINT_TOTAL * 10);

			expect(store.canUseHint()).toBe(false);

			vi.advanceTimersByTime(1000);

			expect(store.canUseHint()).toBe(true);

			store.useHint();
			store.toggleFreePlay();

			expect(store.hintUsed()).toBe(true);
			expect(store.record()).toEqual(OPENING);
			expect(store.explorations()).toEqual([{ at: 1, events: [HINT] }]);
		});
	});

	it('replays an exploration onto the very board the main line handed it', () => {
		const store = board();

		walkTo(store, beatAt('a third step back'));
		store.toggleFreePlay();
		play(store, 'a2', 'a3');
		play(store, 'a7', 'a6');
		store.stepBackward();

		// The hint marker sits in the anchored prefix and moves nothing, which is the only
		// thing a replay has to know about it.
		expect(replayExploration(store, 1)).toEqual(describeLine(snapshot(store)));
	});

	it('keeps everything the three of them did out of the main line', () => {
		const store = board();

		walkTo(store, WALK.length - 1);

		expect(store.record()).toEqual([...REVIEWED, -1, 'd1f1']);
		expect(store.explorations()).toEqual(runs(FIRST, SECOND, THIRD));
	});
});

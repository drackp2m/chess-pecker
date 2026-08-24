import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PuzzleEvent } from '@app/definition/puzzle.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { HINT } from '@app/page/puzzle/store/puzzle/record';
import { PuzzleRestore } from '@app/page/puzzle/store/puzzle/session';
import {
	FIVE_PLY,
	HEADER,
	MATE_IN_3,
	MATE_IN_3_FEN,
	REPLAY_TOTAL,
	createStore,
	describeLine,
	playFivePlyLine,
	replayRecord,
	sanHistory,
	snapshot,
} from '@app/testing/puzzle-store.harness';

function board(): PuzzleStore {
	TestBed.resetTestingModule();

	return createStore(`${HEADER}\n${MATE_IN_3}`);
}

function stored(record: readonly PuzzleEvent[], overrides: Partial<PuzzleRestore> = {}) {
	return {
		record,
		freePlayRuns: [],
		result: undefined,
		closure: 'open',
		hintUsed: false,
		mistakeCount: 0,
		...overrides,
	} satisfies PuzzleRestore;
}

describe('PuzzleStore.restoreFrom', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('puts back the very board the record was saved on', () => {
		const played = board();

		playFivePlyLine(played);

		const left = describeLine(snapshot(played));

		const reopened = board();

		reopened.restoreFrom(stored(FIVE_PLY));

		expect(describeLine(snapshot(reopened))).toEqual(left);
		expect(reopened.record()).toEqual(FIVE_PLY);
	});

	it('lands the cursor where a step back had left it', () => {
		const store = board();

		store.restoreFrom(stored([...FIVE_PLY, -2]));

		expect(store.cursor()).toBe(3);
		expect(sanHistory(store)).toEqual(['Rxf8', 'Rb1+', 'Bd1']);
		expect(describeLine(snapshot(store))).toEqual(replayRecord(MATE_IN_3_FEN, [...FIVE_PLY, -2]));
	});

	it('carries back the verdict the row was left on', () => {
		const store = board();

		store.restoreFrom(
			stored([...FIVE_PLY, HINT], {
				result: 'failed',
				closure: 'revealed',
				hintUsed: true,
				mistakeCount: 2,
			}),
		);

		expect(store.result()).toBe('failed');
		expect(store.closure()).toBe('revealed');
		expect(store.hintUsed()).toBe(true);
		expect(store.mistakeCount()).toBe(2);
		expect(store.isOpen()).toBe(false);
	});

	it('always reopens with the player at the bottom, whatever it was left flipped to', () => {
		const store = board();

		store.flipBoard();
		store.restoreFrom(stored(FIVE_PLY));

		expect(store.orientation()).toBe(store.playerColor());
	});

	/** The board is the record's, and the record says nothing was in flight when it was saved. */
	it('leaves nothing playing itself once the board is back', () => {
		const store = board();

		store.restoreFrom(stored(FIVE_PLY));

		const restored = describeLine(snapshot(store));

		expect(store.isBusy()).toBe(false);
		expect(store.announcedMove()).toBeUndefined();

		vi.advanceTimersByTime(REPLAY_TOTAL * 4);

		expect(describeLine(snapshot(store))).toEqual(restored);
	});

	it('travels the move the line is standing on, and only that one', () => {
		const store = board();

		store.restoreFrom(stored(FIVE_PLY));

		const transition = store.transition();

		expect(transition?.kind).toBe('forward');
		expect(transition?.stages).toHaveLength(1);
		expect(transition?.stages[0]?.slides).toEqual([{ from: 'f8', to: 'f1' }]);
	});

	/**
	 * A restart walks the cursor back to the opening move the board plays for itself, so
	 * what travels is that move and the rest of the line is left where it was found.
	 */
	it('travels the opening move again for a line that was restarted', () => {
		const store = board();

		store.restoreFrom(stored([...FIVE_PLY, 0]));

		expect(store.cursor()).toBe(1);
		expect(store.line()).toHaveLength(5);
		expect(store.transition()?.stages[0]?.slides).toMatchObject([{ from: 'f1', to: 'f8' }]);
	});

	it('has nothing to travel when the record holds no move at all', () => {
		const store = board();

		store.restoreFrom(stored([]));

		expect(store.cursor()).toBe(0);
		expect(store.transition()).toBeUndefined();
	});

	/** The verdict outlives the line: a row that cannot be read is still a row that was graded. */
	it('degrades a record that does not replay to the board the exercise opened on', () => {
		const store = board();

		store.restoreFrom(stored(['f1f8', 'a1a2'], { result: 'failed', mistakeCount: 1 }));

		expect(store.cursor()).toBe(0);
		expect(store.line()).toEqual([]);
		expect(store.result()).toBe('failed');
		expect(store.mistakeCount()).toBe(1);
	});

	/** The record does not say whether one was open, so what comes back is the line it hangs off. */
	it('comes back on the main line, with no free-play run standing', () => {
		const store = board();

		store.restoreFrom(stored(FIVE_PLY, { freePlayRuns: [{ at: 5, events: ['f1f2'] }] }));

		expect(store.isFreePlay()).toBe(false);
		expect(store.freePlayRuns()).toEqual([{ at: 5, events: ['f1f2'] }]);
		expect(describeLine(snapshot(store))).toEqual(replayRecord(MATE_IN_3_FEN, FIVE_PLY));
	});

	it('reads the exercise as still being solved where the record left it mid-line', () => {
		const store = board();

		store.restoreFrom(stored(['f1f8', 'b2b1', 'b3d1']));

		expect(store.outcome()).toBe('solving');
		expect(store.canPlay()).toBe(true);
	});
});

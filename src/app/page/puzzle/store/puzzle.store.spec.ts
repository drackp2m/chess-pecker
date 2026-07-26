import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library.store';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle.store';

const HEADER = 'PuzzleId,FEN,Moves,Rating,Popularity,NbPlays,Themes,GameUrl,SelectedFor';
const MATE_IN_3 =
	'JOGv3,5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27,f1f8 b2b1 b3d1 b1d1 f8f1 d1f1,536,100,2178,backRankMate endgame long mate mateIn3,https://lichess.org/fFWULcre#53,500-599';
const SHORT =
	'ABC12,4k3/8/8/8/8/8/R7/4K2R w - - 0 1,h1h5 e8d8 a2a8,900,90,10,mate mateIn1,https://example.org,900-999';

function createStore(csv: string): PuzzleStore {
	TestBed.configureTestingModule({ providers: [PuzzleLibraryStore, PuzzleStore] });

	const store = TestBed.inject(PuzzleStore);

	store.loadCsv(csv);
	vi.advanceTimersByTime(500);

	return store;
}

describe('PuzzleStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('opens the exercise by replaying the opponent move first', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		// The FEN has white to move, so the player takes black.
		expect(store.playerColor()).toBe('black');
		expect(store.orientation()).toBe('black');
		expect(store.cursor()).toBe(1);
		expect(store.history()[0]?.san).toBe('Rxf8');
		expect(store.outcome()).toBe('solving');
		expect(store.isPlayerTurn()).toBe(true);
	});

	it('accepts the scripted solution and replies for the opponent', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('b1');

		expect(store.history()[1]?.san).toBe('Rb1+');
		expect(store.outcome()).toBe('replying');

		vi.advanceTimersByTime(500);

		expect(store.history()[2]?.san).toBe('Bd1');
		expect(store.outcome()).toBe('solving');
		expect(store.progress()).toEqual({ solvedMoves: 1, totalMoves: 3, playerColor: 'black' });
	});

	it('solves the whole line', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		for (const [from, to] of [
			['b2', 'b1'],
			['b1', 'd1'],
			['d1', 'f1'],
		] as const) {
			store.selectSquare(from);
			store.selectSquare(to);
			vi.advanceTimersByTime(500);
		}

		expect(store.outcome()).toBe('solved');
		expect(store.history().at(-1)?.san).toBe('Rxf1#');
		expect(store.progress().solvedMoves).toBe(3);
	});

	it('marks a wrong move as a mistake without adding it to the line', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('c2');

		expect(store.outcome()).toBe('failed');
		expect(store.mistake()?.to).toBe('c2');
		expect(store.history()).toHaveLength(1);
		expect(store.cursor()).toBe(1);
		expect(store.isLocked()).toBe(true);
	});

	it('takes the mistake back on step-back and lets you retry', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('c2');

		expect(store.canStepBackward()).toBe(true);

		store.stepBackward();

		expect(store.mistake()).toBeUndefined();
		expect(store.outcome()).toBe('solving');
		expect(store.isPlayerTurn()).toBe(true);

		store.selectSquare('b2');
		store.selectSquare('b1');

		expect(store.outcome()).toBe('replying');
		expect(store.history()[1]?.san).toBe('Rb1+');
	});

	it('steps backward and forward through the played line', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('b1');
		vi.advanceTimersByTime(500);

		expect(store.cursor()).toBe(3);

		store.stepBackward();
		store.stepBackward();

		expect(store.cursor()).toBe(1);
		expect(store.history()).toHaveLength(1);
		expect(store.canStepForward()).toBe(true);

		store.stepForward();

		expect(store.cursor()).toBe(2);
		expect(store.history()).toHaveLength(2);

		// Rewinding never destroys the line.
		expect(store.line()).toHaveLength(3);
	});

	it('navigates between exercises and restarts them', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}\n${SHORT}`);

		expect(store.library.puzzles()).toHaveLength(2);
		expect(store.library.hasPrevious()).toBe(false);
		expect(store.library.hasNext()).toBe(true);

		store.nextPuzzle();
		vi.advanceTimersByTime(500);

		expect(store.puzzle()?.id).toBe('ABC12');
		expect(store.library.hasNext()).toBe(false);

		store.previousPuzzle();
		vi.advanceTimersByTime(500);

		expect(store.puzzle()?.id).toBe('JOGv3');
		expect(store.cursor()).toBe(1);

		store.selectSquare('b2');
		store.selectSquare('b1');
		vi.advanceTimersByTime(500);
		store.restart();
		vi.advanceTimersByTime(500);

		expect(store.cursor()).toBe(1);
		expect(store.line()).toHaveLength(1);
	});

	it('reports an unreadable import', () => {
		TestBed.configureTestingModule({ providers: [PuzzleLibraryStore, PuzzleStore] });

		const store = TestBed.inject(PuzzleStore);

		expect(store.loadCsv('nonsense')).toBe(false);
		expect(store.library.importError()).toBeDefined();
		expect(store.outcome()).toBe('idle');
	});
});

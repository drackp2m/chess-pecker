import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library.store';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle.store';

const HEADER = 'PuzzleId,FEN,Moves,Rating,Popularity,NbPlays,Themes,GameUrl,SelectedFor';
const MATE_IN_3 =
	'JOGv3,5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27,f1f8 b2b1 b3d1 b1d1 f8f1 d1f1,536,100,2178,backRankMate endgame long mate mateIn3,https://lichess.org/fFWULcre#53,500-599';
const SHORT =
	'ABC12,4k3/8/8/8/8/8/R7/4K2R w - - 0 1,h1h5 e8d8 a2a8,900,90,10,mate mateIn1,https://example.org,900-999';

/** Long enough for both beats of the replay: the piece lights up, then it moves. */
const REPLAY_TOTAL = 1500;

function createStore(csv: string): PuzzleStore {
	TestBed.configureTestingModule({ providers: [PuzzleLibraryStore, PuzzleStore] });

	const store = TestBed.inject(PuzzleStore);

	store.loadCsv(csv);
	vi.advanceTimersByTime(REPLAY_TOTAL);

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

	it('lights the opponent piece up before it actually moves', () => {
		TestBed.configureTestingModule({ providers: [PuzzleLibraryStore, PuzzleStore] });

		const store = TestBed.inject(PuzzleStore);

		store.loadCsv(`${HEADER}\n${MATE_IN_3}`);
		vi.advanceTimersByTime(350);

		// First beat: the rook on f1 is announced but has not left its square.
		expect(store.announcedMove()?.from).toBe('f1');
		expect(store.announcedMove()?.to).toBe('f8');
		expect(store.history()).toHaveLength(0);
		expect(store.isBusy()).toBe(true);

		vi.advanceTimersByTime(REPLAY_TOTAL);

		// Second beat: the highlight clears and the move lands.
		expect(store.announcedMove()).toBeUndefined();
		expect(store.history()[0]?.san).toBe('Rxf8');
		expect(store.isBusy()).toBe(false);
	});

	it('accepts the scripted solution and replies for the opponent', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('b1');

		expect(store.history()[1]?.san).toBe('Rb1+');
		expect(store.outcome()).toBe('replying');

		vi.advanceTimersByTime(REPLAY_TOTAL);

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
			vi.advanceTimersByTime(REPLAY_TOTAL);
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

	it('reports each kind of transition so the policy can judge it', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('b1');

		// Playing a move.
		expect(store.transition()).toMatchObject({ from: 'b2', to: 'b1', kind: 'played' });

		const tick = store.transition()?.tick ?? 0;

		vi.advanceTimersByTime(REPLAY_TOTAL);

		expect(store.transition()).toMatchObject({ to: 'd1', kind: 'played' });
		expect(store.transition()?.tick).toBeGreaterThan(tick);

		store.stepBackward();

		// Taking a move back travels the other way, so the squares are reversed.
		expect(store.transition()).toMatchObject({ from: 'd1', to: 'b3', kind: 'backward' });

		store.stepForward();

		expect(store.transition()).toMatchObject({ from: 'b3', to: 'd1', kind: 'forward' });
	});

	it('steps backward and forward through the played line', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('b1');
		vi.advanceTimersByTime(REPLAY_TOTAL);

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
		vi.advanceTimersByTime(REPLAY_TOTAL);

		expect(store.puzzle()?.id).toBe('ABC12');
		expect(store.library.hasNext()).toBe(false);

		store.previousPuzzle();
		vi.advanceTimersByTime(REPLAY_TOTAL);

		expect(store.puzzle()?.id).toBe('JOGv3');
		expect(store.cursor()).toBe(1);

		store.selectSquare('b2');
		store.selectSquare('b1');
		vi.advanceTimersByTime(REPLAY_TOTAL);
		store.restart();
		vi.advanceTimersByTime(REPLAY_TOTAL);

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

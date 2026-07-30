import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MISTAKE_POLICY, MistakePolicy } from '@app/definition/mistake-policy.type';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library.store';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle.store';
import { MistakePolicyService } from '@app/service/mistake-policy.service';

const HEADER = 'PuzzleId,FEN,Moves,Rating,Popularity,NbPlays,Themes,GameUrl,SelectedFor';
const MATE_IN_3 =
	'JOGv3,5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27,f1f8 b2b1 b3d1 b1d1 f8f1 d1f1,536,100,2178,backRankMate endgame long mate mateIn3,https://lichess.org/fFWULcre#53,500-599';
const SHORT =
	'ABC12,4k3/8/8/8/8/8/R7/4K2R w - - 0 1,h1h5 e8d8 a2a8,900,90,10,mate mateIn1,https://example.org,900-999';
/** The script walks to mate with Qg4 first, but Qg7 mates straight away. */
const ALT_MATE =
	'ALT99,7k/p7/7K/8/8/8/8/R5Q1 b - - 0 1,a7a6 g1g4 a6a5 g4g7,700,80,50,mate mateIn2,https://example.org,700-799';

/** Long enough for both beats of the replay: the piece lights up, then it moves. */
const REPLAY_TOTAL = 1500;

/** Stubbed whole, so the store is tested against a policy and not against IndexedDB. */
function configure(policy: Partial<MistakePolicy> = {}): PuzzleStore {
	TestBed.configureTestingModule({
		providers: [
			PuzzleLibraryStore,
			PuzzleStore,
			{
				provide: MistakePolicyService,
				useValue: { policy: signal({ ...DEFAULT_MISTAKE_POLICY, ...policy }) },
			},
		],
	});

	return TestBed.inject(PuzzleStore);
}

function createStore(csv: string, policy: Partial<MistakePolicy> = {}): PuzzleStore {
	const store = configure(policy);

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
		const store = configure();

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

	it('ends the exercise on any mate, not only the scripted one', () => {
		const store = createStore(`${HEADER}\n${ALT_MATE}`);

		expect(store.playerColor()).toBe('white');
		expect(store.history()[0]?.san).toBe('a6');

		// Qg4 is what the script asks for; Qg7 mates two plies early.
		store.selectSquare('g1');
		store.selectSquare('g7');

		expect(store.history().at(-1)?.san).toBe('Qg7#');
		expect(store.outcome()).toBe('solved');
		expect(store.isLocked()).toBe(true);

		// And no scripted reply is attempted from a position where it is illegal.
		vi.advanceTimersByTime(REPLAY_TOTAL);

		expect(store.history()).toHaveLength(2);
		expect(store.outcome()).toBe('solved');
	});

	it('keeps a wrong move on the board and marks it', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('c2');

		expect(store.outcome()).toBe('failed');
		expect(store.mistake()?.to).toBe('c2');
		expect(store.history()).toHaveLength(2);
		expect(store.cursor()).toBe(2);
		expect(store.isFreePlay()).toBe(true);
		expect(store.progress().solvedMoves).toBe(0);
	});

	it('lets both sides be played by hand once the script is broken', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('c2');

		// The board is now the opponent's to move, and it is the player who moves it.
		expect(store.isLocked()).toBe(false);
		expect(store.isPlayerTurn()).toBe(false);
		expect(store.position().turn).toBe('white');

		store.selectSquare('a2');
		store.selectSquare('a3');

		expect(store.history()).toHaveLength(3);
		expect(store.history().at(-1)?.isOpponent).toBe(true);
		expect(store.position().turn).toBe('black');
		expect(store.outcome()).toBe('failed');

		// Illegal moves are still refused: the rook on c2 cannot jump to c8 through c6.
		store.selectSquare('c2');
		store.selectSquare('c8');

		expect(store.history()).toHaveLength(3);
	});

	it('returns to solving once the cursor is rewound onto the script', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('c2');
		store.selectSquare('a2');
		store.selectSquare('a3');

		expect(store.cursor()).toBe(3);

		store.stepBackward();

		// Still past the deviation, so the board stays free.
		expect(store.outcome()).toBe('failed');
		expect(store.isFreePlay()).toBe(true);

		store.stepBackward();

		expect(store.outcome()).toBe('solving');
		expect(store.isFreePlay()).toBe(false);
		expect(store.isPlayerTurn()).toBe(true);
		expect(store.mistake()).toBeUndefined();

		// Playing the solution from there drops the whole free-play branch.
		store.selectSquare('b2');
		store.selectSquare('b1');

		expect(store.line()).toHaveLength(2);
		expect(store.history()[1]?.san).toBe('Rb1+');
		expect(store.outcome()).toBe('replying');
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

	it('settles the verdict on the first try and keeps it through a retry', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('c2');

		expect(store.result()).toBe('failed');

		store.stepBackward();
		store.selectSquare('b2');
		store.selectSquare('b1');

		// The board moves on, the recorded verdict does not.
		expect(store.outcome()).toBe('replying');
		expect(store.result()).toBe('failed');
		expect(store.isPractice()).toBe(true);
	});

	it('takes the wrong move back on its own when asked to', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`, { undoMistake: true });

		store.selectSquare('b2');
		store.selectSquare('c2');

		// It stays up long enough to be seen.
		expect(store.mistake()?.to).toBe('c2');
		expect(store.cursor()).toBe(2);

		vi.advanceTimersByTime(1000);

		expect(store.mistake()).toBeUndefined();
		expect(store.cursor()).toBe(1);
		expect(store.outcome()).toBe('solving');
		expect(store.canPlay()).toBe(true);
	});

	it('locks the board after a miss when free play is off', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`, { freePlay: false });

		store.selectSquare('b2');
		store.selectSquare('c2');

		expect(store.isFreePlay()).toBe(true);
		expect(store.isLocked()).toBe(true);

		store.selectSquare('a2');
		store.selectSquare('a3');

		expect(store.history()).toHaveLength(2);
	});

	it('refuses a second attempt when retrying is off', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`, { retry: false });

		store.selectSquare('b2');
		store.selectSquare('c2');
		store.stepBackward();

		// Back on the script, and still not yours to play.
		expect(store.outcome()).toBe('solving');
		expect(store.isLocked()).toBe(true);

		store.selectSquare('b2');
		store.selectSquare('b1');

		expect(store.selected()).toBeUndefined();
		expect(store.line()).toHaveLength(2);
	});

	it('plays the rest of the solution out, without touching the verdict', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.selectSquare('b2');
		store.selectSquare('c2');
		store.revealSolution();

		expect(store.isRevealing()).toBe(true);

		vi.advanceTimersByTime(REPLAY_TOTAL * 5);

		// The move that strayed is gone and the scripted line stands in its place.
		expect(store.isRevealing()).toBe(false);
		expect(store.history()).toHaveLength(6);
		expect(store.history()[1]?.san).toBe('Rb1+');
		expect(store.history().at(-1)?.san).toBe('Rxf1#');
		expect(store.outcome()).toBe('solved');
		expect(store.result()).toBe('failed');
	});

	it('offers the solution only while the setting allows it', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`, { showSolution: false });

		store.selectSquare('b2');
		store.selectSquare('c2');

		expect(store.isSolutionOffered()).toBe(false);
		expect(store.canRevealSolution()).toBe(false);

		store.revealSolution();

		expect(store.isRevealing()).toBe(false);
		expect(store.history()).toHaveLength(2);
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
		const store = configure();

		expect(store.loadCsv('nonsense')).toBe(false);
		expect(store.library.importError()).toBeDefined();
		expect(store.outcome()).toBe('idle');
	});
});

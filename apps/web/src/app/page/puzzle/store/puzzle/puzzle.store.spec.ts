import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardTransition } from '@app/definition/board-animation.type';
import { Square } from '@app/definition/chess.type';
import { DEFAULT_MISTAKE_POLICY, MistakePolicy } from '@app/definition/mistake-policy.type';
import { DEFAULT_MOVE_SPEED, MoveSpeed, scaleForSpeed } from '@app/definition/move-speed.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { MistakePolicyService } from '@app/service/mistake-policy.service';
import { SoundService } from '@app/service/sound.service';

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
/** One ply of it, so a reveal can be watched a move at a time. */
const REPLAY_PLY = 800;
/** Long enough for the refuted move to be taken back on its own. */
const UNDO_TOTAL = 1000;

/**
 * Every settings-backed service is stubbed whole, so the store is tested against a
 * policy rather than against IndexedDB — and so no test needs an `AudioContext`.
 */
function configure(
	policy: Partial<MistakePolicy> = {},
	speed: MoveSpeed = DEFAULT_MOVE_SPEED,
): PuzzleStore {
	TestBed.configureTestingModule({
		providers: [
			PuzzleLibraryStore,
			PuzzleStore,
			{
				provide: MistakePolicyService,
				useValue: { policy: signal({ ...DEFAULT_MISTAKE_POLICY, ...policy }) },
			},
			{ provide: BoardPreferenceService, useValue: { moveSpeed: signal(speed) } },
			{ provide: SoundService, useValue: { playMove: (): void => undefined } },
		],
	});

	return TestBed.inject(PuzzleStore);
}

function createStore(
	csv: string,
	policy: Partial<MistakePolicy> = {},
	speed: MoveSpeed = DEFAULT_MOVE_SPEED,
): PuzzleStore {
	const store = configure(policy, speed);

	store.loadCsv(csv);
	vi.advanceTimersByTime(REPLAY_TOTAL * 2);

	return store;
}

function play(store: PuzzleStore, from: Square, to: Square): void {
	store.selectSquare(from);
	store.selectSquare(to);
}

/** The first solving move of `MATE_IN_3` is Rb1+; Rc2 is a legal move that is not it. */
function miss(store: PuzzleStore): void {
	play(store, 'b2', 'c2');
}

/**
 * The slides the board would actually run. Signals are glitch-free, so a transition
 * only ever reaches the DOM if it is the one still standing when the block that set
 * it returns — which is where this samples, and why a slide overwritten in the same
 * breath is one the player never sees.
 */
function createSlideLog(store: PuzzleStore) {
	const slides: BoardTransition[] = [];

	return {
		slides,

		sample(): void {
			const transition = store.transition();

			if (undefined !== transition && transition.tick !== slides.at(-1)?.tick) {
				slides.push(transition);
			}
		},
	};
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

		miss(store);

		expect(store.outcome()).toBe('failed');
		expect(store.mistake()?.to).toBe('c2');
		expect(store.history()).toHaveLength(2);
		expect(store.cursor()).toBe(2);
		expect(store.mistakeCount()).toBe(1);
		// The board is off the script, but no free-play session has been opened.
		expect(store.isOffScript()).toBe(true);
		expect(store.isFreePlay()).toBe(false);
		expect(store.progress().solvedMoves).toBe(0);
	});

	it('takes the wrong move back on its own and lets it be tried again', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		miss(store);

		// It stays up long enough to be seen.
		expect(store.mistake()?.to).toBe('c2');
		expect(store.cursor()).toBe(2);

		vi.advanceTimersByTime(UNDO_TOTAL);

		expect(store.mistake()).toBeUndefined();
		expect(store.cursor()).toBe(1);
		expect(store.outcome()).toBe('solving');
		expect(store.canPlay()).toBe(true);

		store.selectSquare('b2');
		store.selectSquare('b1');

		expect(store.outcome()).toBe('replying');
		expect(store.history()[1]?.san).toBe('Rb1+');
	});

	it('settles the verdict on the first try and keeps it through a retry', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		miss(store);

		expect(store.result()).toBe('failed');

		vi.advanceTimersByTime(UNDO_TOTAL);
		store.selectSquare('b2');
		store.selectSquare('b1');

		// The board moves on, the recorded verdict does not.
		expect(store.outcome()).toBe('replying');
		expect(store.result()).toBe('failed');
		expect(store.isPractice()).toBe(true);
	});

	it('plays on from a miss as free play, instead of taking the move back', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		miss(store);

		// The board is now the opponent's to move, and it is the player who moves it.
		expect(store.isLocked()).toBe(false);
		expect(store.isPlayerTurn()).toBe(false);
		expect(store.position().turn).toBe('white');

		store.selectSquare('a2');
		store.selectSquare('a3');

		expect(store.isFreePlay()).toBe(true);
		expect(store.history()).toHaveLength(3);
		expect(store.history().at(-1)?.isOpponent).toBe(true);
		expect(store.position().turn).toBe('black');
		expect(store.outcome()).toBe('failed');

		// Illegal moves are still refused: the rook on c2 cannot jump to c8 through c6.
		store.selectSquare('c2');
		store.selectSquare('c8');

		expect(store.history()).toHaveLength(3);

		// And the take-back never fires, because the move it was waiting on is buried.
		vi.advanceTimersByTime(UNDO_TOTAL);

		expect(store.cursor()).toBe(3);
	});

	it('leaves the exercise exactly as free play found it', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.toggleFreePlay();

		expect(store.isFreePlay()).toBe(true);

		// Both sides are playable, and none of it is judged.
		store.selectSquare('b2');
		store.selectSquare('c2');
		store.selectSquare('a2');
		store.selectSquare('a3');

		expect(store.history()).toHaveLength(3);
		expect(store.outcome()).toBe('solving');
		expect(store.result()).toBeUndefined();
		expect(store.mistakeCount()).toBe(0);
		expect(store.mistake()).toBeUndefined();
		expect(store.progress().solvedMoves).toBe(0);

		store.toggleFreePlay();

		expect(store.isFreePlay()).toBe(false);
		expect(store.line()).toHaveLength(1);
		expect(store.cursor()).toBe(1);
		expect(store.outcome()).toBe('solving');
		expect(store.isPlayerTurn()).toBe(true);
	});

	it('does not grade a wrong move played in free play', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		store.toggleFreePlay();
		miss(store);

		expect(store.result()).toBeUndefined();
		expect(store.outcome()).toBe('solving');

		store.toggleFreePlay();

		// Back on the exercise, untouched, with the miss still to be made.
		expect(store.result()).toBeUndefined();
		expect(store.isPlayerTurn()).toBe(true);
	});

	it('returns to solving once the cursor is rewound onto the script', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		miss(store);
		store.selectSquare('a2');
		store.selectSquare('a3');

		expect(store.cursor()).toBe(3);

		// Leaving free play gives the refuted position back; the script resumes one
		// step further back, where the move that broke it has been undone.
		store.toggleFreePlay();

		expect(store.cursor()).toBe(2);
		expect(store.outcome()).toBe('failed');

		store.stepBackward();

		expect(store.outcome()).toBe('solving');
		expect(store.isOffScript()).toBe(false);
		expect(store.isPlayerTurn()).toBe(true);
		expect(store.mistake()).toBeUndefined();

		// Playing the solution from there drops the whole free-play branch.
		store.selectSquare('b2');
		store.selectSquare('b1');

		expect(store.line()).toHaveLength(2);
		expect(store.history()[1]?.san).toBe('Rb1+');
		expect(store.outcome()).toBe('replying');
	});

	it('plays the rest of the solution out, without touching the verdict', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		miss(store);
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

	it('refuses the solution before the exercise has been failed, and after it was seen', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		expect(store.canRevealSolution()).toBe(false);

		store.revealSolution();

		expect(store.isRevealing()).toBe(false);
		expect(store.history()).toHaveLength(1);

		miss(store);

		expect(store.canRevealSolution()).toBe(true);

		store.revealSolution();
		vi.advanceTimersByTime(REPLAY_TOTAL * 5);

		// Once seen, it is spent: the navigation buttons are what replays it.
		expect(store.isRevealed()).toBe(true);
		expect(store.canRevealSolution()).toBe(false);
	});

	it('plays the solution on its own once the misses reach the threshold', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`, { mistakesBeforeSolution: 2 });

		miss(store);
		vi.advanceTimersByTime(UNDO_TOTAL);

		// One miss short of the threshold: taken back, and nothing else.
		expect(store.cursor()).toBe(1);
		expect(store.isRevealing()).toBe(false);

		miss(store);
		vi.advanceTimersByTime(UNDO_TOTAL);

		expect(store.mistakeCount()).toBe(2);
		expect(store.isRevealing()).toBe(true);

		vi.advanceTimersByTime(REPLAY_TOTAL * 5);

		expect(store.history().at(-1)?.san).toBe('Rxf1#');
		expect(store.outcome()).toBe('solved');
		expect(store.result()).toBe('failed');
	});

	it('never plays the solution on its own when the threshold is off', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`, { mistakesBeforeSolution: 0 });

		for (let attempt = 0; 3 > attempt; attempt += 1) {
			miss(store);
			vi.advanceTimersByTime(UNDO_TOTAL);
		}

		expect(store.mistakeCount()).toBe(3);
		expect(store.isRevealed()).toBe(false);
		expect(store.cursor()).toBe(1);
		expect(store.outcome()).toBe('solving');
	});

	it('counts misses per exercise, resetting them when the next one opens', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}\n${SHORT}`, { mistakesBeforeSolution: 0 });

		miss(store);
		vi.advanceTimersByTime(UNDO_TOTAL);

		expect(store.mistakeCount()).toBe(1);

		store.nextPuzzle();
		vi.advanceTimersByTime(REPLAY_TOTAL);

		expect(store.mistakeCount()).toBe(0);
		expect(store.result()).toBeUndefined();
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

	it('gives every board event a tick of its own, whatever the exercise did before', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`, { mistakesBeforeSolution: 2 });
		const log = createSlideLog(store);

		/** One run through every way the board can move, sampled where the DOM settles. */
		const variations = [
			(): void => {
				play(store, 'b2', 'b1');
			},
			(): void => {
				vi.advanceTimersByTime(REPLAY_TOTAL);
			},
			(): void => {
				store.stepBackward();
			},
			(): void => {
				store.stepForward();
			},
			(): void => {
				store.toggleFreePlay();
				play(store, 'a7', 'a6');
			},
			(): void => {
				store.toggleFreePlay();
			},
			(): void => {
				store.restart();
				vi.advanceTimersByTime(REPLAY_TOTAL);
			},
			(): void => {
				miss(store);
			},
			(): void => {
				vi.advanceTimersByTime(UNDO_TOTAL);
			},
			(): void => {
				miss(store);
			},
			(): void => {
				vi.advanceTimersByTime(UNDO_TOTAL);
			},
			(): void => {
				vi.advanceTimersByTime(REPLAY_TOTAL * 5);
			},
		];

		log.sample();

		for (const variation of variations) {
			variation();
			log.sample();
		}

		const ticks = log.slides.map((slide) => slide.tick);

		// The walk covered the whole policy, so every level of it was exercised.
		expect(new Set(log.slides.map((slide) => slide.kind))).toEqual(
			new Set(['played', 'forward', 'backward']),
		);

		// A tick that came round twice would be taken for a slide that has already
		// run, and the piece would stand there refusing to move.
		expect(new Set(ticks).size).toBe(ticks.length);
		expect(ticks).toEqual([...ticks].sort((left, right) => left - right));
	});

	it('slides the opening move again when the exercise is reopened after a miss', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);
		const opening = store.transition();

		miss(store);
		vi.advanceTimersByTime(UNDO_TOTAL);
		store.restart();
		vi.advanceTimersByTime(REPLAY_TOTAL);

		const reopened = store.transition();

		// The same move onto the same square as before, so only the tick tells the two
		// slides apart — and the miss in between must not have rewound it.
		expect(reopened).toMatchObject({ from: 'f1', to: 'f8', kind: 'played' });
		expect(reopened?.tick).toBeGreaterThan(opening?.tick ?? 0);
	});

	it('leaves the take-back on screen when the answer follows it in the same breath', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`, { mistakesBeforeSolution: 2 });

		miss(store);
		vi.advanceTimersByTime(UNDO_TOTAL);
		miss(store);

		const refuted = store.transition();

		vi.advanceTimersByTime(UNDO_TOTAL);

		// The take-back and the reveal it sets off land together; the reveal rewinds to
		// the square the line already stood on, so it has nothing to take back over.
		expect(store.isRevealing()).toBe(true);
		expect(store.transition()).toMatchObject({ from: 'c2', to: 'b2', kind: 'backward' });
		expect(store.transition()?.tick).toBeGreaterThan(refuted?.tick ?? 0);

		vi.advanceTimersByTime(REPLAY_PLY);

		// And the answer played out from there arrives under a tick of its own.
		expect(store.transition()).toMatchObject({ from: 'b2', to: 'b1', kind: 'played' });
	});

	it('waits on the refuted move for as long as the chosen move speed says', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`, {}, 'slow');

		miss(store);

		// The pause is a beat of the playback like any other, so it stretches with it.
		vi.advanceTimersByTime(UNDO_TOTAL);

		expect(store.mistake()?.to).toBe('c2');

		vi.advanceTimersByTime(scaleForSpeed(UNDO_TOTAL, 'slow') - UNDO_TOTAL);

		expect(store.mistake()).toBeUndefined();
		expect(store.cursor()).toBe(1);
	});

	it('drops the slide when a reveal rewinds the board out from under it', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		miss(store);

		// The refuted move is still up, so revealing has to rewind past it: the piece
		// is about to be somewhere else entirely, and its slide no longer describes it.
		expect(store.transition()).toMatchObject({ to: 'c2', kind: 'played' });

		store.revealSolution();

		expect(store.transition()).toBeUndefined();
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

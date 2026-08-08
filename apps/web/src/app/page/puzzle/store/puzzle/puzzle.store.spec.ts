import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardTransition, BoardTransitionKind } from '@app/definition/board-animation.type';
import { Square } from '@app/definition/chess.type';
import {
	ANNOUNCE_DELAY,
	DEFAULT_MOVE_SPEED,
	RESUME_DELAY,
	scaleForSpeed,
} from '@app/definition/move-speed.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import {
	ALT_MATE,
	FIVE_PLY,
	HEADER,
	MATE_IN_3,
	MATE_IN_3_FEN,
	REPLAY_PLY,
	REPLAY_TOTAL,
	SHORT,
	UNDO_TOTAL,
	configure,
	createStore,
	miss,
	play,
	playFivePlyLine,
	replayRecord,
	snapshot,
} from '@app/testing/puzzle-store.harness';
import { ChessFen } from '@app/util/chess/chess-fen';

/** What the board is about to slide, flattened to the one beat a plain move takes. */
interface FlatSlide {
	readonly from: Square | undefined;
	readonly to: Square | undefined;
	readonly kind: BoardTransitionKind | undefined;
	readonly tick: number | undefined;
}

function slideOf(transition: BoardTransition | undefined): FlatSlide {
	const stage = transition?.stages[0];
	const slide = stage?.slides[0];

	return { from: slide?.from, to: slide?.to, kind: transition?.kind, tick: stage?.tick };
}

/**
 * The slides the board would actually run. Signals are glitch-free, so a transition
 * only ever reaches the DOM if it is the one still standing when the block that set
 * it returns — which is where this samples, and why a slide overwritten in the same
 * breath is one the player never sees.
 */
function createSlideLog(store: PuzzleStore) {
	const slides: FlatSlide[] = [];

	return {
		slides,

		sample(): void {
			const slide = slideOf(store.transition());

			if (undefined !== slide.tick && slide.tick !== slides.at(-1)?.tick) {
				slides.push(slide);
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

		store.loadCsv(`${HEADER}\n${MATE_IN_3}`, 'Spec set');
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

	it('refuses the solution before the exercise has been failed', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		expect(store.canRevealSolution()).toBe(false);

		store.revealSolution();

		expect(store.isRevealing()).toBe(false);
		expect(store.history()).toHaveLength(1);

		miss(store);

		expect(store.canRevealSolution()).toBe(true);
	});

	it('plays the line out again every time it is asked for after the exercise is over', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		miss(store);
		store.revealSolution();
		vi.advanceTimersByTime(REPLAY_TOTAL * 5);

		expect(store.canRevealSolution()).toBe(true);

		// Nothing is left ahead, so it starts the line over instead of standing still.
		store.revealSolution();

		expect(store.isRevealing()).toBe(true);
		expect(store.cursor()).toBe(0);

		vi.advanceTimersByTime(REPLAY_TOTAL * 6);

		expect(store.isRevealing()).toBe(false);
		expect(store.history()).toHaveLength(6);
		expect(store.history().at(-1)?.san).toBe('Rxf1#');
	});

	it('counts misses per exercise, resetting them when the next one opens', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}\n${SHORT}`);

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
		expect(slideOf(store.transition())).toMatchObject({ from: 'b2', to: 'b1', kind: 'played' });

		const tick = slideOf(store.transition()).tick ?? 0;

		vi.advanceTimersByTime(REPLAY_TOTAL);

		expect(slideOf(store.transition())).toMatchObject({ to: 'd1', kind: 'played' });
		expect(slideOf(store.transition()).tick).toBeGreaterThan(tick);

		store.stepBackward();

		// Taking a move back travels the other way, so the squares are reversed.
		expect(slideOf(store.transition())).toMatchObject({ from: 'd1', to: 'b3', kind: 'backward' });

		store.stepForward();

		expect(slideOf(store.transition())).toMatchObject({ from: 'b3', to: 'd1', kind: 'forward' });
	});

	/**
	 * The board is redrawn from scratch when the exercise is picked up again, so what it
	 * shows is the line it was left on — and a rewind is how that line came to be looked
	 * at from there, not something to be watched happening a second time.
	 */
	it('replays the move the line stands on, not the last thing done to the board', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		playFivePlyLine(store);
		store.stepBackward();

		expect(slideOf(store.transition())).toMatchObject({ kind: 'backward' });

		const recorded = store.record();

		store.replayLastMove();

		// The take-back is off the board at once, and the line stands where the move it
		// is about to run was played from.
		expect(store.transition()).toBeUndefined();
		expect(store.announcedMove()).toBeUndefined();
		expect(store.cursor()).toBe(3);

		vi.advanceTimersByTime(scaleForSpeed(RESUME_DELAY, DEFAULT_MOVE_SPEED));

		// Nothing here was asked for just now, so the piece is named before it travels.
		expect(store.announcedMove()).toMatchObject({ from: 'b1', to: 'd1' });
		expect(store.cursor()).toBe(3);

		vi.advanceTimersByTime(scaleForSpeed(ANNOUNCE_DELAY, DEFAULT_MOVE_SPEED));

		expect(store.announcedMove()).toBeUndefined();
		expect(store.cursor()).toBe(4);
		expect(slideOf(store.transition())).toMatchObject({ from: 'b1', to: 'd1', kind: 'forward' });
		// None of it happened to the line, so none of it is in the record.
		expect(store.record()).toEqual(recorded);
	});

	it('takes no input while it replays the move the exercise was left on', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		playFivePlyLine(store);
		store.replayLastMove();

		expect(store.isBusy()).toBe(true);

		vi.advanceTimersByTime(REPLAY_TOTAL);

		expect(store.isBusy()).toBe(false);
		expect(store.cursor()).toBe(5);
	});

	it('leaves a refuted move to the take-back it is already waiting for', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		miss(store);
		store.replayLastMove();

		// Dropped all the same: the move is on screen already and the board comes back
		// to it standing there.
		expect(store.transition()).toBeUndefined();

		vi.advanceTimersByTime(UNDO_TOTAL);

		expect(store.mistake()).toBeUndefined();
		expect(store.cursor()).toBe(1);
	});

	it('has nothing to replay before the exercise has moved at all', () => {
		const store = configure();

		store.replayLastMove();
		vi.advanceTimersByTime(REPLAY_TOTAL);

		expect(store.transition()).toBeUndefined();
		expect(store.cursor()).toBe(0);
	});

	it('gives every board event a tick of its own, whatever the exercise did before', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);
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
			// The restart left the line standing, so the board has to be walked back up
			// to it before a piece can be moved again.
			(): void => {
				store.stepForward();
				store.stepForward();
			},
			(): void => {
				play(store, 'b1', 'c1');
			},
			(): void => {
				vi.advanceTimersByTime(UNDO_TOTAL);
			},
			(): void => {
				play(store, 'b1', 'c1');
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

		const ticks = log.slides.map((slide) => slide.tick ?? 0);

		// The walk covered every way the board moves on its own.
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
		const opening = slideOf(store.transition());

		miss(store);
		vi.advanceTimersByTime(UNDO_TOTAL);
		store.restart();
		vi.advanceTimersByTime(REPLAY_TOTAL);

		const reopened = slideOf(store.transition());

		// The same move onto the same square as before, so only the tick tells the two
		// slides apart — and the miss in between must not have rewound it. It travels as
		// a replay and not as a move: the line already had it, and still does.
		expect(reopened).toMatchObject({ from: 'f1', to: 'f8', kind: 'forward' });
		expect(reopened.tick).toBeGreaterThan(opening.tick ?? 0);
	});

	it('leaves the take-back on screen when the answer follows it in the same breath', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`);

		miss(store);
		vi.advanceTimersByTime(UNDO_TOTAL);
		miss(store);

		const refuted = slideOf(store.transition());

		vi.advanceTimersByTime(UNDO_TOTAL);
		store.revealSolution();

		// The take-back and the reveal that follows it land together; the reveal rewinds
		// to the square the line already stood on, so it has nothing to take back over.
		expect(store.isRevealing()).toBe(true);
		expect(slideOf(store.transition())).toMatchObject({ from: 'c2', to: 'b2', kind: 'backward' });
		expect(slideOf(store.transition()).tick).toBeGreaterThan(refuted.tick ?? 0);

		vi.advanceTimersByTime(REPLAY_PLY);

		// And the answer played out from there arrives under a tick of its own.
		expect(slideOf(store.transition())).toMatchObject({ from: 'b2', to: 'b1', kind: 'played' });
	});

	it('waits on the refuted move for as long as the chosen move speed says', () => {
		const store = createStore(`${HEADER}\n${MATE_IN_3}`, 'slow');

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
		expect(slideOf(store.transition())).toMatchObject({ to: 'c2', kind: 'played' });

		store.revealSolution();

		expect(store.transition()).toBeUndefined();
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

		// Back to the opening move, with everything that was played still standing.
		expect(store.cursor()).toBe(1);
		expect(store.line()).toHaveLength(3);
	});

	it('reports an unreadable import', () => {
		const store = configure();

		expect(store.loadCsv('nonsense', 'Spec set')).toBe(false);
		expect(store.library.importError()).toBeDefined();
		expect(store.outcome()).toBe('idle');
	});

	describe('free play', () => {
		interface Exploration {
			readonly entry: string;
			readonly arrive: (store: PuzzleStore) => void;
			readonly moves: readonly (readonly [Square, Square])[];
		}

		const rewindToPlyTwo = (store: PuzzleStore): void => {
			playFivePlyLine(store);
			store.stepBackward();
			store.stepBackward();
			store.stepBackward();
		};

		const EXPLORATIONS: readonly Exploration[] = [
			{
				entry: 'the opening position',
				arrive: (): void => undefined,
				moves: [
					['a7', 'a6'],
					['a2', 'a3'],
				],
			},
			{
				entry: 'a cursor rewound into a longer line',
				arrive: rewindToPlyTwo,
				moves: [
					['f8', 'f1'],
					['b7', 'b6'],
				],
			},
			{
				entry: 'the end of a played line',
				arrive: playFivePlyLine,
				moves: [
					['h5', 'f4'],
					['a2', 'a3'],
				],
			},
			{
				entry: 'a position off the script',
				arrive: miss,
				moves: [
					['a2', 'a3'],
					['b7', 'b6'],
				],
			},
		];

		for (const exploration of EXPLORATIONS) {
			it(`comes back to ${exploration.entry} exactly as it left it`, () => {
				const store = createStore(`${HEADER}\n${MATE_IN_3}`);

				exploration.arrive(store);

				const entry = snapshot(store);
				const outcome = store.outcome();
				const result = store.result();

				store.toggleFreePlay();

				for (const [from, to] of exploration.moves) {
					play(store, from, to);
				}

				store.stepBackward();
				store.stepForward();

				expect(store.isFreePlay()).toBe(true);
				expect(store.cursor()).toBe(entry.cursor + exploration.moves.length);
				expect(store.line()).not.toEqual(entry.line);

				store.toggleFreePlay();

				expect(store.isFreePlay()).toBe(false);
				expect(snapshot(store)).toEqual(entry);
				expect(store.outcome()).toBe(outcome);
				expect(store.result()).toBe(result);
			});
		}

		it('restarts the exercise inside free play, opponent reply and all', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			store.toggleFreePlay();

			const entry = snapshot(store);

			play(store, 'a7', 'a6');
			play(store, 'a2', 'a3');
			store.restart();

			expect(store.isFreePlay()).toBe(true);
			expect(store.cursor()).toBe(0);
			expect(store.line()).toHaveLength(0);
			expect(ChessFen.serialize(store.position())).toBe(MATE_IN_3_FEN);
			expect(store.isBusy()).toBe(true);

			vi.advanceTimersByTime(REPLAY_TOTAL);

			expect(store.isFreePlay()).toBe(true);
			expect(store.cursor()).toBe(1);
			expect(store.history()).toHaveLength(1);
			expect(store.history()[0]?.san).toBe('Rxf8');
			expect(store.isLocked()).toBe(false);
			expect(store.outcome()).toBe('solving');

			store.stepBackward();

			expect(store.cursor()).toBe(0);
			expect(ChessFen.serialize(store.position())).toBe(MATE_IN_3_FEN);
			expect(store.line()).toHaveLength(1);

			store.toggleFreePlay();

			expect(store.isFreePlay()).toBe(false);
			expect(snapshot(store)).toEqual(entry);
			expect(store.outcome()).toBe('solving');
			expect(store.isPlayerTurn()).toBe(true);
		});

		it('gives the entry point back after the exploration was restarted', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			rewindToPlyTwo(store);
			store.toggleFreePlay();

			const entry = snapshot(store);

			play(store, 'f8', 'f1');
			play(store, 'b7', 'b6');
			store.restart();
			vi.advanceTimersByTime(REPLAY_TOTAL);

			expect(store.isFreePlay()).toBe(true);
			expect(store.cursor()).toBe(1);
			expect(store.line()).toHaveLength(1);

			play(store, 'b2', 'c2');

			expect(store.cursor()).toBe(2);
			expect(store.result()).toBeUndefined();

			store.toggleFreePlay();

			expect(store.isFreePlay()).toBe(false);
			expect(snapshot(store)).toEqual(entry);
			expect(store.cursor()).toBe(2);
			expect(store.line()).toHaveLength(5);
			expect(store.outcome()).toBe('solving');
		});

		it('drops what the exploration had in flight when it is left', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			rewindToPlyTwo(store);
			store.toggleFreePlay();

			const entry = snapshot(store);

			store.restart();
			vi.advanceTimersByTime(400);

			expect(store.announcedMove()?.to).toBe('f8');

			store.toggleFreePlay();
			vi.advanceTimersByTime(REPLAY_TOTAL * 2);

			expect(store.isFreePlay()).toBe(false);
			expect(snapshot(store)).toEqual(entry);
			expect(store.announcedMove()).toBeUndefined();
			expect(store.isBusy()).toBe(false);
			expect(store.outcome()).toBe('solving');
		});

		it('leaves the take-back the exercise had waiting to do its job', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			miss(store);
			store.toggleFreePlay();
			store.toggleFreePlay();
			vi.advanceTimersByTime(UNDO_TOTAL);

			expect(store.cursor()).toBe(1);
			expect(store.mistake()).toBeUndefined();
			expect(store.isFreePlay()).toBe(false);
		});

		it('keeps the verdict the exercise was graded on through a restarted exploration', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			miss(store);
			store.toggleFreePlay();
			store.restart();
			vi.advanceTimersByTime(REPLAY_TOTAL);

			expect(store.isFreePlay()).toBe(true);
			expect(store.result()).toBe('failed');
			expect(store.mistakeCount()).toBe(1);

			store.toggleFreePlay();

			expect(store.result()).toBe('failed');
			expect(store.outcome()).toBe('failed');
			expect(store.cursor()).toBe(2);
		});

		it('never lets a scripted move land inside an exploration', () => {
			const store = configure();

			store.loadCsv(`${HEADER}\n${MATE_IN_3}`, 'Spec set');
			vi.advanceTimersByTime(200);
			store.toggleFreePlay();
			vi.advanceTimersByTime(REPLAY_TOTAL * 2);

			expect(store.freePlay()?.line ?? store.line()).toHaveLength(1);
			expect(store.outcome()).toBe('solving');
			expect(store.isLocked()).toBe(false);
		});

		it('is only ever entered on purpose while the verdict is still open', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			playFivePlyLine(store);
			store.stepBackward();
			store.stepForward();
			store.restart();
			vi.advanceTimersByTime(REPLAY_TOTAL);
			store.stepForward();
			store.stepForward();
			store.stepForward();
			store.stepForward();

			expect(store.result()).toBeUndefined();
			expect(store.isFreePlay()).toBe(false);

			play(store, 'd1', 'd2');

			expect(store.result()).toBe('failed');
			expect(store.isFreePlay()).toBe(false);

			play(store, 'a2', 'a3');

			expect(store.isFreePlay()).toBe(true);
		});

		it('does not solve the exercise with the solution played in free play', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			store.toggleFreePlay();

			const entry = snapshot(store);

			// The whole script, mate included, played by hand: in free play both sides are
			// the player's, so nothing here is answered for them and nothing is graded.
			for (const [from, to] of [
				['b2', 'b1'],
				['b3', 'd1'],
				['b1', 'd1'],
				['f8', 'f1'],
				['d1', 'f1'],
			] as const) {
				play(store, from, to);
				vi.advanceTimersByTime(REPLAY_TOTAL);
			}

			// The board is mated and says so; the exercise has not moved an inch.
			expect(store.freePlayStatus()).toBe('checkmate');
			expect(store.outcome()).toBe('solving');
			expect(store.result()).toBeUndefined();
			expect(store.progress().solvedMoves).toBe(0);

			store.toggleFreePlay();

			expect(snapshot(store)).toEqual(entry);
			expect(store.outcome()).toBe('solving');
			expect(store.result()).toBeUndefined();
			expect(store.progress().solvedMoves).toBe(0);
			expect(store.isPlayerTurn()).toBe(true);
		});

		it('leaves a solved verdict to be earned after the exploration', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			store.toggleFreePlay();
			play(store, 'a7', 'a6');
			play(store, 'a2', 'a3');
			store.stepBackward();
			store.toggleFreePlay();

			expect(store.result()).toBeUndefined();

			for (const [from, to] of [
				['b2', 'b1'],
				['b1', 'd1'],
				['d1', 'f1'],
			] as const) {
				play(store, from, to);
				vi.advanceTimersByTime(REPLAY_TOTAL);
			}

			expect(store.outcome()).toBe('solved');
			expect(store.result()).toBe('solved');
		});

		it('leaves a failed verdict to be earned after the exploration', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			store.toggleFreePlay();
			miss(store);
			play(store, 'a2', 'a3');
			store.toggleFreePlay();

			expect(store.result()).toBeUndefined();
			expect(store.mistakeCount()).toBe(0);

			miss(store);

			expect(store.result()).toBe('failed');
			expect(store.outcome()).toBe('failed');
			expect(store.mistakeCount()).toBe(1);
		});
	});

	describe('the closure', () => {
		const SOLVING_LINE = [
			['b2', 'b1'],
			['b1', 'd1'],
			['d1', 'f1'],
		] as const;

		function solve(store: PuzzleStore): void {
			for (const [from, to] of SOLVING_LINE) {
				play(store, from, to);
				vi.advanceTimersByTime(REPLAY_TOTAL);
			}
		}

		it('outlives the verdict: a miss grades the attempt but does not end it', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			miss(store);
			vi.advanceTimersByTime(UNDO_TOTAL);

			expect(store.result()).toBe('failed');
			expect(store.closure()).toBe('open');

			solve(store);

			// Found on the retry: the exercise is over, the note it was sealed with is not.
			expect(store.closure()).toBe('found');
			expect(store.result()).toBe('failed');
		});

		it('closes on any mate that ends the line, scripted or not', () => {
			const store = createStore(`${HEADER}\n${ALT_MATE}`);

			play(store, 'g1', 'g7');

			expect(store.closure()).toBe('found');
			expect(store.result()).toBe('solved');
		});

		it('is never reached by the answer playing itself', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			miss(store);
			store.revealSolution();

			expect(store.closure()).toBe('revealed');

			vi.advanceTimersByTime(REPLAY_TOTAL * 5);

			// The line is complete, but it is not the player who completed it.
			expect(store.outcome()).toBe('solved');
			expect(store.closure()).toBe('revealed');
		});

		it('is not something free play can reach, mate and all', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			store.toggleFreePlay();

			for (const [from, to] of [
				['b2', 'b1'],
				['b3', 'd1'],
				['b1', 'd1'],
				['f8', 'f1'],
				['d1', 'f1'],
			] as const) {
				play(store, from, to);
				vi.advanceTimersByTime(REPLAY_TOTAL);
			}

			expect(store.freePlayStatus()).toBe('checkmate');
			expect(store.closure()).toBe('open');
		});

		it('is settled by the first ask for the answer, and no later one revises it', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			miss(store);
			store.revealSolution();

			expect(store.closure()).toBe('revealed');

			vi.advanceTimersByTime(REPLAY_TOTAL * 5);
			store.revealSolution();

			expect(store.closure()).toBe('revealed');
		});

		it('survives a restart, along with the verdict, the misses and the hint', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			store.useHint();
			miss(store);
			vi.advanceTimersByTime(UNDO_TOTAL);
			store.revealSolution();
			vi.advanceTimersByTime(REPLAY_TOTAL * 5);
			store.restart();
			vi.advanceTimersByTime(REPLAY_TOTAL);

			expect(store.cursor()).toBe(1);
			expect(store.closure()).toBe('revealed');
			expect(store.result()).toBe('failed');
			expect(store.mistakeCount()).toBe(1);
			expect(store.hintUsed()).toBe(true);
		});

		it('opens the next exercise on a clean slate', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}\n${SHORT}`);

			store.useHint();
			miss(store);
			store.revealSolution();
			vi.advanceTimersByTime(REPLAY_TOTAL * 5);
			store.nextPuzzle();
			vi.advanceTimersByTime(REPLAY_TOTAL);

			expect(store.closure()).toBe('open');
			expect(store.result()).toBeUndefined();
			expect(store.mistakeCount()).toBe(0);
			expect(store.hintUsed()).toBe(false);
		});
	});

	describe('the hint', () => {
		it('uncovers the themes and closes nothing', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			expect(store.canUseHint()).toBe(true);
			expect(store.areThemesShown()).toBe(false);

			store.useHint();

			expect(store.hintUsed()).toBe(true);
			expect(store.areThemesShown()).toBe(true);
			expect(store.canUseHint()).toBe(false);
			expect(store.closure()).toBe('open');
			expect(store.result()).toBeUndefined();
			expect(store.isPlayerTurn()).toBe(true);
		});

		it('is spent once the exercise is over, which hands the themes over anyway', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			miss(store);
			store.revealSolution();
			vi.advanceTimersByTime(REPLAY_TOTAL * 5);

			expect(store.canUseHint()).toBe(false);
			expect(store.hintUsed()).toBe(false);
			expect(store.areThemesShown()).toBe(true);
		});
	});

	describe('the solve record', () => {
		it('is the script and nothing else for a clean solve', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			for (const [from, to] of [
				['b2', 'b1'],
				['b1', 'd1'],
				['d1', 'f1'],
			] as const) {
				play(store, from, to);
				vi.advanceTimersByTime(REPLAY_TOTAL);
			}

			expect(store.record()).toEqual([...FIVE_PLY, 'd1f1']);
			expect(store.explorations()).toEqual([]);
		});

		it('stays open through a miss, so the take-back and the retry are both in it', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			miss(store);

			expect(store.record()).toEqual(['f1f8', 'b2c2']);

			vi.advanceTimersByTime(UNDO_TOTAL * 2);

			// The verdict is settled by now, and the exercise is still being solved.
			expect(store.cursor()).toBe(1);
			expect(store.record()).toEqual(['f1f8', 'b2c2', -1]);

			play(store, 'b2', 'b1');

			expect(store.result()).toBe('failed');
			expect(store.record()).toEqual(['f1f8', 'b2c2', -1, 'b2b1']);
		});

		it('keeps an exploration made after the miss, anchor and all', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			miss(store);
			vi.advanceTimersByTime(UNDO_TOTAL);
			store.toggleFreePlay();
			play(store, 'b2', 'c2');
			store.toggleFreePlay();

			expect(store.record()).toEqual(['f1f8', 'b2c2', -1]);
			expect(store.explorations()).toEqual([{ at: 3, events: ['b2c2'] }]);
		});

		it('writes the rewind giving up does, and nothing the answer plays after it', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			miss(store);
			store.revealSolution();

			// The refuted move was still on the board, so the answer had to rewind onto the
			// script first — a step like any other, and the last one the record ever takes.
			expect(store.record()).toEqual(['f1f8', 'b2c2', -1]);

			vi.advanceTimersByTime(REPLAY_TOTAL * 5);

			expect(store.history().at(-1)?.san).toBe('Rxf1#');
			expect(store.record()).toEqual(['f1f8', 'b2c2', -1]);
			expect(replayRecord(MATE_IN_3_FEN, store.record()).cursor).toBe(1);
		});

		it('keeps a restart made inside an exploration out of the main line', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			store.toggleFreePlay();
			play(store, 'a7', 'a6');
			store.restart();
			vi.advanceTimersByTime(REPLAY_TOTAL);

			expect(store.record()).toEqual(['f1f8']);
			expect(store.explorations()).toEqual([{ at: 1, events: ['a7a6', 0, 'f1f8'] }]);
		});

		it('anchors an exploration to the length the main line had reached', () => {
			const store = createStore(`${HEADER}\n${MATE_IN_3}`);

			playFivePlyLine(store);
			store.stepBackward();
			store.stepBackward();
			store.stepBackward();
			store.toggleFreePlay();
			play(store, 'f8', 'f1');
			store.stepBackward();
			store.toggleFreePlay();

			// Straight back in, with nothing in between: same anchor, second exploration.
			store.toggleFreePlay();
			store.toggleFreePlay();

			expect(store.record()).toEqual([...FIVE_PLY, -3]);
			expect(store.explorations()).toEqual([
				{ at: 6, events: ['f8f1', -1] },
				{ at: 6, events: [] },
			]);
		});
	});
});

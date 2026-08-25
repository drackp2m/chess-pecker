import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBoardPlayback } from '@app/component/chess-board/board-playback';
import {
	BoardSlideStep,
	BoardStage,
	BoardTransition,
	BoardTransitionKind,
	MoveAnimation,
} from '@app/definition/board-animation.type';
import { ChessPosition, PieceColor } from '@app/definition/chess.type';
import {
	DEFAULT_MOVE_SPEED,
	MoveSpeed,
	REPLAY_DELAY,
	SLIDE_DURATION,
} from '@app/definition/move-speed.type';
import { MoveSound } from '@app/definition/sound.type';
import { SoundService } from '@app/service/sound.service';
import { ChessFen } from '@app/util/chess/chess-fen';

/** The board an en passant retreat leaves behind: nothing else ever holds it. */
const INTERMEDIATE = ChessFen.parse('4k3/8/3p4/4P3/8/8/8/4K3 w - - 0 2');

let lastTick = 0;

const play = vi.fn();

function stageOf(
	slides: Pick<BoardSlideStep, 'from' | 'to'>[],
	board?: ChessPosition,
	sound: MoveSound = 'move',
): BoardStage {
	lastTick += 1;

	return {
		slides: slides.map((step) => ({ ...step, taken: undefined })),
		board,
		sound,
		tick: lastTick,
	};
}

/** A move across the board, under a tick of its own the way the stores hand them out. */
function transitionOf(kind: BoardTransitionKind = 'played'): BoardTransition {
	return { kind, stages: [stageOf([{ from: 'a1', to: 'h1' }])] };
}

/** Two pieces travelling under one beat, which a stage carries as many of as it likes. */
function togetherOf(): BoardTransition {
	return {
		kind: 'played',
		stages: [
			stageOf([
				{ from: 'e1', to: 'g1' },
				{ from: 'h1', to: 'f1' },
			]),
		],
	};
}

/**
 * Two beats, the first one running a board the state never sees: the pawn taken en
 * passant steps back, and the capture that follows is what lands the move.
 */
function stagedOf(): BoardTransition {
	return {
		kind: 'played',
		stages: [
			stageOf([{ from: 'd5', to: 'd6' }], INTERMEDIATE, 'move'),
			stageOf([{ from: 'e5', to: 'd6' }], undefined, 'capture'),
		],
	};
}

function createBoard(animation: MoveAnimation = 'always', speed: MoveSpeed = DEFAULT_MOVE_SPEED) {
	const input = {
		transition: signal<BoardTransition | undefined>(undefined),
		animation: signal<MoveAnimation>(animation),
		orientation: signal<PieceColor>('white'),
		speed: signal<MoveSpeed>(speed),
	};
	const playback = TestBed.runInInjectionContext(() => createBoardPlayback(input));

	return {
		...input,
		...playback,

		/** Hands a transition over the way a store patch does, effects and all. */
		show(transition: BoardTransition): void {
			input.transition.set(transition);
			TestBed.tick();
		},
	};
}

/** The board is redrawn constantly; only what it holds at each read reaches a piece. */
function readTwice<T>(source: () => T): [T, T] {
	return [source(), source()];
}

describe('createBoardPlayback', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		play.mockClear();
		TestBed.configureTestingModule({
			providers: [{ provide: SoundService, useValue: { play } }],
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('slides only the square the move landed on', () => {
		const board = createBoard();

		expect(board.slides()).toEqual([]);

		board.show(transitionOf());

		expect(board.slides()).toHaveLength(1);
		expect(board.slides()[0]?.to).toBe('h1');
		expect(board.slides()[0]?.slide).toMatchObject({ x: -700, y: 0 });
	});

	it('keys the slide by the tick alone, so a redraw cannot pass it off as a new one', () => {
		const board = createBoard();

		board.show(transitionOf());

		const [first, second] = readTwice(() => board.slides()[0]?.slide.key);

		expect(first).toBe(second);
		expect(first).toBe(board.transition()?.stages[0]?.tick);
	});

	it('sends every piece a beat moves on its way, under the one tick they share', () => {
		const board = createBoard();

		board.show(togetherOf());

		expect(board.slides().map((pending) => pending.to)).toEqual(['g1', 'f1']);
		expect(new Set(board.slides().map((pending) => pending.slide.key)).size).toBe(1);
		// The rook travels two files and the king travels two; they cross the same way.
		expect(board.slides()[1]?.slide).toMatchObject({ x: 200, y: 0 });
	});

	it('withholds the slide the setting had no time for', () => {
		const board = createBoard('never');

		board.show(transitionOf());

		expect(board.slides()).toEqual([]);
	});

	/**
	 * Why the setting is read outside the reactive graph: turning the animation on long after
	 * a move would send the settled piece sailing in from the square it left.
	 */
	it('does not replay a move already on screen when the setting is turned up', () => {
		const board = createBoard('never');

		board.show(transitionOf());

		expect(board.slides()).toEqual([]);

		board.animation.set('always');

		expect(board.slides()).toEqual([]);
	});

	it('applies the new setting from the next move on', () => {
		const board = createBoard('never');

		board.show(transitionOf());
		board.animation.set('always');
		board.show(transitionOf());

		expect(board.slides()[0]?.to).toBe('h1');
	});

	it('does not replay the last move when the board is flipped', () => {
		const board = createBoard();

		board.show(transitionOf());

		const before = board.slides()[0]?.slide;

		board.orientation.set('black');

		// Same slide, same key: the piece knows it by that key and will not run it twice.
		expect(board.slides()[0]?.slide).toEqual(before);
	});

	it('measures the next move against the orientation it is played under', () => {
		const board = createBoard();

		board.show(transitionOf());
		board.orientation.set('black');
		board.show(transitionOf());

		// Travelling the same way on a flipped board means coming from the other side.
		expect(board.slides()[0]?.slide).toMatchObject({ x: 700, y: 0 });
	});

	it('holds each level of the policy to the kind of move it covers', () => {
		const kinds: readonly BoardTransitionKind[] = ['played', 'forward', 'backward'];
		const animated = (['always', 'forward', 'first', 'never'] as const).map((animation) =>
			kinds.filter((kind) => {
				const board = createBoard(animation);

				board.show(transitionOf(kind));

				return 0 < board.slides().length;
			}),
		);

		expect(animated).toEqual([kinds, ['played', 'forward'], ['played'], []]);
	});

	it('runs a staged move beat by beat, over the board each beat lands on', () => {
		const board = createBoard();

		board.show(stagedOf());

		// The captured pawn steps back onto the square it is about to be taken on.
		expect(board.board()).toEqual(INTERMEDIATE);
		expect(board.slides().map((pending) => pending.to)).toEqual(['d6']);

		const retreat = board.slides()[0]?.slide.key ?? 0;

		vi.advanceTimersByTime(SLIDE_DURATION);

		// The last beat lands on the position the state itself moved to, and comes in
		// under a tick of its own so the pawn that captures runs its own slide.
		expect(board.board()).toBeUndefined();
		expect(board.slides().map((pending) => pending.to)).toEqual(['d6']);
		expect(board.slides()[0]?.slide.key).toBeGreaterThan(retreat);
	});

	it('keeps the beats when nothing slides, spaced by the opponent’s own pause', () => {
		const board = createBoard('never');

		board.show(stagedOf());

		expect(board.slides()).toEqual([]);
		expect(board.board()).toEqual(INTERMEDIATE);

		vi.advanceTimersByTime(SLIDE_DURATION);

		// A silent beat is over the instant it is drawn, so it waits out the longer
		// pause instead of flashing past.
		expect(board.board()).toEqual(INTERMEDIATE);

		vi.advanceTimersByTime(REPLAY_DELAY - SLIDE_DURATION);

		expect(board.board()).toBeUndefined();
	});

	it('stretches the beats with the chosen move speed', () => {
		const board = createBoard('always', 'slow');

		board.show(stagedOf());
		vi.advanceTimersByTime(SLIDE_DURATION);

		expect(board.board()).toEqual(INTERMEDIATE);

		vi.advanceTimersByTime(SLIDE_DURATION);

		expect(board.board()).toBeUndefined();
	});

	it('starts every transition from its first beat, whatever the last one reached', () => {
		const board = createBoard();

		board.show(stagedOf());
		vi.advanceTimersByTime(SLIDE_DURATION);

		expect(board.board()).toBeUndefined();

		board.show(stagedOf());

		expect(board.board()).toEqual(INTERMEDIATE);
	});

	it('voices a move as it lands, with the clip its beat carries', () => {
		const board = createBoard();

		board.show(transitionOf());
		vi.advanceTimersByTime(SLIDE_DURATION * 2);

		expect(play.mock.calls).toEqual([['move', 'forward']]);
	});

	/**
	 * Two pieces travel, so two are heard — each on the beat that sends it off. The
	 * pawn stepping back is only travelling; the capture is what the move came to.
	 */
	it('voices every beat of a staged move, one clip per piece', () => {
		const board = createBoard();

		board.show(stagedOf());

		expect(play.mock.calls).toEqual([['move', 'forward']]);

		vi.advanceTimersByTime(SLIDE_DURATION);

		expect(play.mock.calls).toEqual([
			['move', 'forward'],
			['capture', 'forward'],
		]);
	});

	it('says the beats of a move being taken back the other way round', () => {
		const board = createBoard();

		board.show({ ...stagedOf(), kind: 'backward' });
		vi.advanceTimersByTime(SLIDE_DURATION);

		expect(play.mock.calls).toEqual([
			['move', 'backward'],
			['capture', 'backward'],
		]);
	});

	it('is heard even when the setting left the beats nothing to slide', () => {
		const board = createBoard('never');

		board.show(stagedOf());
		vi.advanceTimersByTime(REPLAY_DELAY);

		expect(play).toHaveBeenCalledTimes(2);
	});

	it('says nothing at all when the board jumps rather than moves', () => {
		const board = createBoard();

		board.transition.set(undefined);
		TestBed.tick();

		expect(play).not.toHaveBeenCalled();
	});

	it('drops the beats still to come when the board jumps instead of moving', () => {
		const board = createBoard();

		board.show(stagedOf());
		board.transition.set(undefined);
		TestBed.tick();

		expect(board.board()).toBeUndefined();
		expect(board.slides()).toEqual([]);

		vi.advanceTimersByTime(SLIDE_DURATION * 2);

		expect(board.board()).toBeUndefined();
	});
});

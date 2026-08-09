import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MOVE_SPEED } from '@app/definition/move-speed.type';
import { I18n } from '@app/i18n';
import { MatchStore } from '@app/page/match/store/match.store';
import { BoardPreferenceService } from '@app/service/board-preference.service';

/** Long enough for both beats: the machine thinks, lights its piece up, then moves. */
const OPPONENT_DELAY = 1500;

/** The board preference is stubbed whole, so no test reaches IndexedDB for a delay. */
function createStore(): MatchStore {
	TestBed.configureTestingModule({
		providers: [
			MatchStore,
			{ provide: BoardPreferenceService, useValue: { moveSpeed: signal(DEFAULT_MOVE_SPEED) } },
		],
	});

	return TestBed.inject(MatchStore);
}

/** Lets the machine's scheduled reply fire. */
function letMachineMove(): void {
	vi.advanceTimersByTime(OPPONENT_DELAY);
}

describe('MatchStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('starts the player as white with an untouched board', () => {
		const store = createStore();

		expect(store.playerColor()).toBe('white');
		expect(store.isPlayerTurn()).toBe(true);
		expect(store.history()).toHaveLength(0);
		expect(store.legalMoves()).toHaveLength(20);
	});

	it('answers the player with a machine move written in notation', () => {
		const store = createStore();

		expect(store.playNotation('e4')).toBe(true);
		expect(store.history()).toHaveLength(1);
		expect(store.isOpponentThinking()).toBe(true);

		letMachineMove();

		expect(store.history()).toHaveLength(2);
		expect(store.history()[1]?.color).toBe('black');
		expect(store.history()[1]?.san).toMatch(/^[a-hKQRBNO]/);
		expect(store.isPlayerTurn()).toBe(true);
	});

	it('lights the machine piece up before it actually moves', () => {
		const store = createStore();

		store.playNotation('e4');
		vi.advanceTimersByTime(400);

		// First beat: a move is announced but the board has not changed.
		const announced = store.announcedMove();

		expect(announced).toBeDefined();
		expect(announced?.color).toBe('black');
		expect(store.history()).toHaveLength(1);

		vi.advanceTimersByTime(OPPONENT_DELAY);

		// Second beat: the highlight clears and that same move is on the board.
		expect(store.announcedMove()).toBeUndefined();
		expect(store.history()).toHaveLength(2);
		expect(store.history()[1]?.from).toBe(announced?.from);
		expect(store.history()[1]?.to).toBe(announced?.to);
	});

	it('lets the machine open the game when the player takes black', () => {
		const store = createStore();

		store.startMatch('black');

		expect(store.playerColor()).toBe('black');
		expect(store.orientation()).toBe('black');
		expect(store.isPlayerTurn()).toBe(false);

		letMachineMove();

		expect(store.history()).toHaveLength(1);
		expect(store.history()[0]?.color).toBe('white');
		expect(store.isPlayerTurn()).toBe(true);
	});

	it('reports a played move as a transition, and none after an undo', () => {
		const store = createStore();

		store.playNotation('e4');

		expect(store.transition()?.kind).toBe('played');
		expect(store.transition()?.stages[0]?.slides).toEqual([{ from: 'e2', to: 'e4' }]);

		vi.advanceTimersByTime(OPPONENT_DELAY);
		store.undoLastMove();

		// Undo rewinds two plies at once, so there is no single slide to show.
		expect(store.transition()).toBeUndefined();
	});

	it('rejects notation that is not legal and reports it', () => {
		const store = createStore();

		expect(store.playNotation('e5')).toBe(false);
		expect(store.notationError()).toEqual({
			key: I18n.match.ILLEGAL_MOVE,
			params: { notation: 'e5' },
		});
		expect(store.history()).toHaveLength(0);

		store.dismissError();

		expect(store.notationError()).toBeUndefined();
	});

	it('moves a piece through square selection', () => {
		const store = createStore();

		store.selectSquare('e2');

		expect(store.selected()).toBe('e2');
		expect(store.movesFromSelection()).toHaveLength(2);

		store.selectSquare('e4');

		expect(store.selected()).toBeUndefined();
		expect(store.history()[0]?.san).toBe('e4');
	});

	it('asks which piece to promote to before playing the move', () => {
		const store = createStore();

		store.loadPosition('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
		store.selectSquare('a7');
		store.selectSquare('a8');

		expect(store.pendingPromotion()).toEqual({ from: 'a7', to: 'a8' });
		expect(store.history()).toHaveLength(0);

		store.completePromotion('rook');

		// The new rook checks the king along the eighth rank.
		expect(store.history()[0]?.san).toBe('a8=R+');
		expect(store.position().board[0]).toEqual({ type: 'rook', color: 'white' });
	});

	it('undoes the player move together with the machine reply', () => {
		const store = createStore();

		store.playNotation('e4');
		letMachineMove();

		expect(store.history()).toHaveLength(2);

		store.undoLastMove();

		expect(store.history()).toHaveLength(0);
		expect(store.isPlayerTurn()).toBe(true);
		expect(store.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
	});

	it('loads an exercise position and hands the side to move to the player', () => {
		const store = createStore();

		expect(store.loadPosition('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 b - - 0 1')).toBe(true);
		expect(store.playerColor()).toBe('black');
		expect(store.isPlayerTurn()).toBe(true);
		expect(store.history()).toHaveLength(0);
	});

	it('refuses an unreadable position', () => {
		const store = createStore();

		expect(store.loadPosition('not a fen')).toBe(false);
		expect(store.notationError()).toBeDefined();
	});

	it('stops the match once the machine is checkmated', () => {
		const store = createStore();

		// Scholar's mate, with the machine forced into the losing side.
		store.loadPosition('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
		store.playNotation('Qxf7');

		expect(store.status()).toBe('checkmate');
		expect(store.isFinished()).toBe(true);
		expect(store.history()[0]?.san).toBe('Qxf7#');

		letMachineMove();

		expect(store.history()).toHaveLength(1);
	});
});

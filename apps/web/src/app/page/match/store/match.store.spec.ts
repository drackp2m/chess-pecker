import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChessPosition } from '@app/definition/chess.type';
import { DEFAULT_MOVE_SPEED } from '@app/definition/move-speed.type';
import { I18n } from '@app/i18n';
import { StockfishOpponentService } from '@app/page/match/service/stockfish-opponent.service';
import type { StockfishElo } from '@app/page/match/service/stockfish-opponent.service';
import { UciGame } from '@app/page/match/service/uci-engine';
import { MatchStore } from '@app/page/match/store/match.store';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessNotation } from '@app/util/chess/chess-notation';

/** Long enough for both beats: the machine thinks, lights its piece up, then moves. */
const OPPONENT_DELAY = 1500;

/** The board preference is stubbed whole, so no test reaches IndexedDB for a delay. */
function createIdleStore(): MatchStore {
	TestBed.configureTestingModule({
		providers: [
			MatchStore,
			{ provide: BoardPreferenceService, useValue: { moveSpeed: signal(DEFAULT_MOVE_SPEED) } },
		],
	});

	return TestBed.inject(MatchStore);
}

function createStore(): MatchStore {
	const store = createIdleStore();

	store.startMatch('white');

	return store;
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

	it('waits for a side to be chosen before the game starts', () => {
		const store = createIdleStore();

		expect(store.status()).toBe('idle');
		expect(store.isStarted()).toBe(false);
		expect(store.isPlayerTurn()).toBe(false);
		expect(store.isLocked()).toBe(true);

		store.selectSquare('e2');

		expect(store.selected()).toBeUndefined();
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

	it('reports a played move as a transition, and none after going back to the start', () => {
		const store = createStore();

		store.playNotation('e4');

		expect(store.transition()?.kind).toBe('played');
		expect(store.transition()?.stages[0]?.slides).toEqual([{ from: 'e2', to: 'e4' }]);

		vi.advanceTimersByTime(OPPONENT_DELAY);
		store.rewind();

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

	it('lets the player move again from an earlier turn and drops what followed', () => {
		const store = createStore();

		store.playNotation('e4');
		letMachineMove();
		store.stepBackward();
		store.stepBackward();

		expect(store.isLocked()).toBe(false);
		expect(store.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

		store.selectSquare('d2');
		store.selectSquare('d4');

		expect(store.moves().map((move) => move.san)).toEqual(['d4']);
		expect(store.isLive()).toBe(true);
		expect(store.isOpponentThinking()).toBe(true);

		letMachineMove();

		expect(store.moves()).toHaveLength(2);
		expect(store.isPlayerTurn()).toBe(true);
	});

	it('keeps the board locked on a past turn that belongs to the machine', () => {
		const store = createStore();

		store.playNotation('e4');
		letMachineMove();
		store.stepBackward();

		expect(store.canMove()).toBe(false);
		expect(store.isLocked()).toBe(true);

		store.selectSquare('e7');

		expect(store.selected()).toBeUndefined();
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

	it('steps back through the game without undoing it', () => {
		const store = createStore();

		store.playNotation('e4');
		letMachineMove();
		store.stepBackward();

		expect(store.history()).toHaveLength(1);
		expect(store.moves()).toHaveLength(2);
		expect(store.isLocked()).toBe(true);
		expect(store.transition()?.kind).toBe('backward');

		store.stepForward();

		expect(store.history()).toHaveLength(2);
		expect(store.isPlayerTurn()).toBe(true);

		store.rewind();

		expect(store.history()).toHaveLength(0);
		expect(store.canStepBackward()).toBe(false);
		expect(store.moves()).toHaveLength(2);
	});

	it('explores both sides without touching the game', () => {
		const store = createStore();

		store.toggleExploration();
		store.selectSquare('e2');
		store.selectSquare('e4');
		store.selectSquare('e7');
		store.selectSquare('e5');

		expect(store.history().map((move) => move.san)).toEqual(['e4', 'e5']);
		expect(store.moves()).toHaveLength(0);
		expect(store.isOpponentThinking()).toBe(false);

		store.toggleExploration();

		expect(store.history()).toHaveLength(0);
		expect(store.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
	});

	it('ends the game on resignation and only then offers a new one', () => {
		const store = createStore();

		store.playNotation('e4');

		expect(store.canStartOver()).toBe(false);

		store.resign();

		expect(store.status()).toBe('resigned');
		expect(store.isFinished()).toBe(true);
		expect(store.canStartOver()).toBe(true);

		letMachineMove();

		expect(store.moves()).toHaveLength(1);

		store.newMatch();

		expect(store.status()).toBe('idle');
		expect(store.moves()).toHaveLength(0);
	});

	it('declines a draw on an even board and takes no second offer on the same move', () => {
		const store = createStore();

		store.offerDraw();

		expect(store.status()).toBe('playing');
		expect(store.isDrawDeclined()).toBe(true);
		expect(store.canOfferDraw()).toBe(false);
	});

	it('accepts a draw when the machine is behind on material', () => {
		const store = createStore();

		store.loadPosition('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1');
		store.offerDraw();

		expect(store.status()).toBe('agreed');
		expect(store.isFinished()).toBe(true);
	});

	it('puts a saved game back from its snapshot', () => {
		const store = createStore();

		store.playNotation('e4');
		letMachineMove();

		const snapshot = store.snapshot();
		const fen = store.fen();

		store.newMatch();
		store.restore(snapshot);

		expect(store.moves()).toHaveLength(2);
		expect(store.status()).toBe('playing');
		expect(store.isPlayerTurn()).toBe(true);
		expect(store.fen()).toBe(fen);
	});
});

describe('MatchStore against Stockfish', () => {
	const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

	function createStockfishStore() {
		const stockfish = {
			newGame: vi.fn(),
			chooseNotation: vi.fn((_game: UciGame, _position: ChessPosition, _elo: StockfishElo) =>
				Promise.resolve<string | undefined>('e7e5'),
			),
		};

		TestBed.configureTestingModule({
			providers: [
				MatchStore,
				{ provide: BoardPreferenceService, useValue: { moveSpeed: signal(DEFAULT_MOVE_SPEED) } },
				{ provide: StockfishOpponentService, useValue: stockfish },
			],
		});

		const store = TestBed.inject(MatchStore);

		store.setOpponentModel('stockfish');

		return { store, stockfish };
	}

	function sentMoves(stockfish: ReturnType<typeof createStockfishStore>['stockfish']): string[] {
		const game = stockfish.chooseNotation.mock.calls.at(-1)?.[0];

		return (game?.moves ?? []).map((move) => ChessNotation.describeLong(move));
	}

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('asks for a reply with every move played since the game started', async () => {
		const { store, stockfish } = createStockfishStore();

		store.startMatch('white');
		store.playNotation('e4');
		await vi.advanceTimersByTimeAsync(OPPONENT_DELAY);

		expect(stockfish.chooseNotation).toHaveBeenCalledTimes(1);
		expect(stockfish.chooseNotation.mock.calls[0]?.[0].start).toEqual(ChessFen.initial());
		expect(sentMoves(stockfish)).toEqual(['e2e4']);
		expect(store.moves().map((move) => move.san)).toEqual(['e4', 'e5']);

		store.playNotation('Nf3');
		await vi.advanceTimersByTimeAsync(OPPONENT_DELAY);

		expect(sentMoves(stockfish)).toEqual(['e2e4', 'e7e5', 'g1f3']);
	});

	it('leaves out the moves a takeback dropped', async () => {
		const { store, stockfish } = createStockfishStore();

		store.startMatch('white');
		store.playNotation('e4');
		await vi.advanceTimersByTimeAsync(OPPONENT_DELAY);
		store.stepBackward();
		store.stepBackward();
		store.selectSquare('d2');
		store.selectSquare('d4');
		await vi.advanceTimersByTimeAsync(OPPONENT_DELAY);

		expect(sentMoves(stockfish)).toEqual(['d2d4']);
	});

	it('starts from the loaded position, not from the usual one', async () => {
		const { store, stockfish } = createStockfishStore();

		store.loadPosition(AFTER_E4);
		store.playNotation('e5');
		await vi.advanceTimersByTimeAsync(OPPONENT_DELAY);

		const start = stockfish.chooseNotation.mock.calls[0]?.[0].start;

		expect(undefined === start ? undefined : ChessFen.serialize(start)).toBe(AFTER_E4);
		expect(sentMoves(stockfish)).toEqual(['e7e5']);
	});

	it('tells the engine whenever a different game begins', () => {
		const { store, stockfish } = createStockfishStore();

		store.startMatch('white');

		expect(stockfish.newGame).toHaveBeenCalledTimes(1);

		store.playNotation('e4');
		const snapshot = store.snapshot();

		store.newMatch();

		expect(stockfish.newGame).toHaveBeenCalledTimes(2);

		store.loadPosition(AFTER_E4);

		expect(stockfish.newGame).toHaveBeenCalledTimes(3);

		store.restore(snapshot);

		expect(stockfish.newGame).toHaveBeenCalledTimes(4);
	});

	it('drops a reply that arrives for a game that is already over', async () => {
		const answers: ((move: string | undefined) => void)[] = [];
		const { store, stockfish } = createStockfishStore();

		stockfish.chooseNotation.mockImplementationOnce(
			() =>
				new Promise<string | undefined>((resolve) => {
					answers.push(resolve);
				}),
		);

		store.startMatch('white');
		store.playNotation('e4');
		await vi.advanceTimersByTimeAsync(OPPONENT_DELAY);
		store.newMatch();
		answers[0]?.('e7e5');
		await vi.advanceTimersByTimeAsync(OPPONENT_DELAY);

		expect(store.moves()).toHaveLength(0);
		expect(store.notationError()).toBeUndefined();
	});
});

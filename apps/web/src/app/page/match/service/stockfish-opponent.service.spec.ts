import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChessPosition } from '@app/definition/chess.type';
import { StockfishOpponentService } from '@app/page/match/service/stockfish-opponent.service';
import { UciGame } from '@app/page/match/service/uci-engine';
import { positionAt, replayLine } from '@app/page/match/store/match-state';
import { FakeUciWorker, settleEngine } from '@app/testing/uci-worker.harness';
import { ChessFen } from '@app/util/chess/chess-fen';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

interface Played {
	readonly game: UciGame;
	readonly position: ChessPosition;
}

function play(notations: readonly string[], fen: string = START_FEN): Played {
	const start = ChessFen.parse(fen);
	const line = replayLine(start, notations);

	return { game: { start, moves: line.moves }, position: positionAt(line) };
}

function ask(service: StockfishOpponentService, played: Played, elo: 500 | 2300 = 2300) {
	return service.chooseNotation(played.game, played.position, elo);
}

describe('StockfishOpponentService', () => {
	let service: StockfishOpponentService;

	beforeEach(() => {
		FakeUciWorker.reset();
		vi.stubGlobal('Worker', FakeUciWorker);
		TestBed.configureTestingModule({});
		service = TestBed.inject(StockfishOpponentService);
	});

	afterEach(() => {
		TestBed.resetTestingModule();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('the position it sends', () => {
		it('carries every move since the start, so the engine can see repetitions', async () => {
			const answer = ask(service, play(['e2e4', 'e7e5', 'g1f3']));

			await settleEngine();

			const worker = FakeUciWorker.latest();

			expect(worker.sent).toContain(`position fen ${START_FEN} moves e2e4 e7e5 g1f3`);
			expect(worker.sent.at(-1)).toBe('go movetime 1000');

			worker.emit('bestmove b8c6 ponder f1b5');

			await expect(answer).resolves.toBe('b8c6');
		});

		it('starts a game set up from a FEN at that FEN, with only the moves since', async () => {
			void ask(service, play(['e7e5'], AFTER_E4));

			await settleEngine();

			expect(FakeUciWorker.latest().sent).toContain(`position fen ${AFTER_E4} moves e7e5`);
		});

		it('sends a bare position before anything has been played', async () => {
			void ask(service, play([]));

			await settleEngine();

			expect(FakeUciWorker.latest().sent).toContain(`position fen ${START_FEN}`);
		});
	});

	describe('games', () => {
		it('sets the strength once and announces a new game only when one begins', async () => {
			const first = ask(service, play(['e2e4']));

			await settleEngine();
			FakeUciWorker.latest().emit('bestmove e7e5');
			await first;

			const second = ask(service, play(['e2e4', 'e7e5', 'g1f3']));

			await settleEngine();
			FakeUciWorker.latest().emit('bestmove b8c6');
			await second;

			service.newGame();

			const third = ask(service, play(['d2d4']));

			await settleEngine();
			FakeUciWorker.latest().emit('bestmove d7d5');
			await third;

			const worker = FakeUciWorker.latest();

			expect(worker.count('setoption name UCI_Elo value 2300')).toBe(1);
			expect(worker.count('ucinewgame')).toBe(2);
			expect(worker.sent.indexOf('ucinewgame')).toBeLessThan(
				worker.sent.findIndex((command) => command.startsWith('position ')),
			);
		});

		it('stops the search in flight when a new game begins', async () => {
			const answer = ask(service, play(['e2e4']));

			await settleEngine();
			service.newGame();

			const worker = FakeUciWorker.latest();

			expect(worker.sent.at(-1)).toBe('stop');

			worker.emit('bestmove e7e5');

			await expect(answer).resolves.toBeUndefined();
		});
	});

	describe('overlapping requests', () => {
		it('stops the search in flight and answers each request with its own move', async () => {
			const first = ask(service, play(['e2e4']));

			await settleEngine();

			const worker = FakeUciWorker.latest();
			const second = ask(service, play(['d2d4']));

			expect(worker.sent.at(-1)).toBe('stop');

			worker.emit('bestmove e7e5');
			await settleEngine();

			await expect(first).resolves.toBeUndefined();
			expect(worker.sent.slice(-2)).toEqual([
				`position fen ${START_FEN} moves d2d4`,
				'go movetime 1000',
			]);

			worker.emit('bestmove g8f6');

			await expect(second).resolves.toBe('g8f6');
		});

		it('never searches a request that was overtaken before it reached the engine', async () => {
			const first = ask(service, play(['e2e4']));
			const second = ask(service, play(['d2d4']));
			const third = ask(service, play(['c2c4']));

			await settleEngine();

			const worker = FakeUciWorker.latest();

			expect(worker.countStarting('go ')).toBe(1);
			expect(worker.countStarting('position ')).toBe(1);
			expect(worker.sent).toContain(`position fen ${START_FEN} moves c2c4`);

			worker.emit('bestmove e7e5');

			await expect(first).resolves.toBeUndefined();
			await expect(second).resolves.toBeUndefined();
			await expect(third).resolves.toBe('e7e5');
		});
	});

	describe('failures', () => {
		it('starts a fresh engine after the worker fails', async () => {
			const first = ask(service, play(['e2e4']));

			await settleEngine();

			const broken = FakeUciWorker.latest();

			broken.fail('boom');

			await expect(first).rejects.toThrow('boom');
			expect(broken.isTerminated).toBe(true);

			void ask(service, play(['e2e4']));
			await settleEngine();

			const fresh = FakeUciWorker.latest();

			expect(fresh).not.toBe(broken);
			expect(fresh.sent[0]).toBe('uci');
			expect(fresh.count('setoption name UCI_Elo value 2300')).toBe(1);
			expect(fresh.count('ucinewgame')).toBe(1);
		});
	});

	describe('humanized strength', () => {
		it('searches several candidates without the strength limit and picks among them', async () => {
			vi.spyOn(Math, 'random').mockReturnValue(0.99);

			const answer = ask(service, play(['e2e4']), 500);

			await settleEngine();

			const worker = FakeUciWorker.latest();

			expect(worker.sent).toContain('setoption name UCI_LimitStrength value false');
			expect(worker.sent).toContain('setoption name MultiPV value 8');
			expect(worker.sent.at(-1)).toBe('go depth 1');

			worker.emit('info depth 1 seldepth 1 multipv 1 score cp 30 nodes 20 pv e7e5');
			worker.emit('bestmove e7e5');

			await expect(answer).resolves.toBe('e7e5');
		});
	});
});

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChessPosition } from '@app/definition/chess.type';
import { PositionAnalysisService } from '@app/page/match/service/position-analysis.service';
import { UciGame } from '@app/page/match/service/uci-engine';
import { positionAt, replayLine } from '@app/page/match/store/match-state';
import { FakeUciWorker, settleEngine } from '@app/testing/uci-worker.harness';
import { ChessFen } from '@app/util/chess/chess-fen';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const DEPTH = 12;

interface Played {
	readonly game: UciGame;
	readonly position: ChessPosition;
}

function play(notations: readonly string[]): Played {
	const start = ChessFen.initial();
	const line = replayLine(start, notations);

	return { game: { start, moves: line.moves }, position: positionAt(line) };
}

function info(depth: number, centipawns: number): string {
	return `info depth ${String(depth)} seldepth ${String(depth)} multipv 1 score cp ${String(centipawns)} nodes 1000 pv e2e4`;
}

describe('PositionAnalysisService', () => {
	let analysis: PositionAnalysisService;

	function analyse(played: Played): void {
		analysis.analyse(played.game, played.position, DEPTH);
	}

	async function finish(worker: FakeUciWorker, centipawns: number): Promise<void> {
		worker.emit(info(DEPTH, centipawns));
		worker.emit('bestmove e2e4');
		await settleEngine();
	}

	beforeEach(() => {
		FakeUciWorker.reset();
		vi.stubGlobal('Worker', FakeUciWorker);
		TestBed.configureTestingModule({ providers: [PositionAnalysisService] });
		analysis = TestBed.inject(PositionAnalysisService);
	});

	afterEach(() => {
		TestBed.resetTestingModule();
		vi.unstubAllGlobals();
	});

	it('sends the line played so far from its starting position', async () => {
		analyse(play(['e2e4', 'e7e5']));
		await settleEngine();

		const worker = FakeUciWorker.latest();

		expect(worker.sent).toContain(`position fen ${START_FEN} moves e2e4 e7e5`);
		expect(worker.sent.at(-1)).toBe(`go depth ${String(DEPTH)}`);
	});

	it('keeps the evaluation of a search that reached its depth', async () => {
		const opening = play([]);

		analyse(opening);
		await settleEngine();

		const worker = FakeUciWorker.latest();

		await finish(worker, 25);
		analyse(play(['e2e4']));
		await settleEngine();
		await finish(worker, 30);
		analyse(opening);
		await settleEngine();

		expect(worker.countStarting('go ')).toBe(2);
		expect(analysis.evaluation()).toMatchObject({
			depth: DEPTH,
			score: { unit: 'cp', value: 25 },
		});
	});

	it('searches again a position whose search was cut short', async () => {
		const opening = play([]);

		analyse(opening);
		await settleEngine();

		const worker = FakeUciWorker.latest();

		worker.emit(info(5, 80));
		analyse(play(['e2e4']));

		expect(worker.sent.at(-1)).toBe('stop');

		worker.emit('bestmove e2e4');
		await settleEngine();
		await finish(worker, 30);
		analyse(opening);
		await settleEngine();

		expect(worker.countStarting('go ')).toBe(3);
	});

	it('analyses a transposition on its own line, since its history can differ', async () => {
		const first = play(['e2e4', 'b8c6', 'g1f3', 'e7e5']);
		const second = play(['g1f3', 'b8c6', 'e2e4', 'e7e5']);

		expect(ChessFen.serialize(first.position)).toBe(ChessFen.serialize(second.position));

		analyse(first);
		await settleEngine();

		const worker = FakeUciWorker.latest();

		await finish(worker, 20);
		analyse(second);
		await settleEngine();

		expect(worker.countStarting('go ')).toBe(2);
		expect(worker.sent.at(-2)).toBe(`position fen ${START_FEN} moves g1f3 b8c6 e2e4 e7e5`);
	});
});

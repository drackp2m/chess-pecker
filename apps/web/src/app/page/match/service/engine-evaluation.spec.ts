import { describe, expect, it } from 'vitest';

import { readEvaluation } from '@app/page/match/service/engine-evaluation';
import { ChessFen } from '@app/util/chess/chess-fen';

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

describe('readEvaluation', () => {
	it('reads the score from white’s side whoever is to move', () => {
		const info =
			'info depth 14 seldepth 20 multipv 1 score cp -35 nodes 120000 nps 400000 hashfull 50 tbhits 0 time 300 pv e7e5 g1f3 b8c6';

		expect(readEvaluation(ChessFen.parse(AFTER_E4), AFTER_E4, info)).toEqual({
			fen: AFTER_E4,
			depth: 14,
			score: { unit: 'cp', value: 35 },
		});
	});

	it('keeps which side delivers the mate', () => {
		const info = 'info depth 20 seldepth 4 multipv 1 score mate 2 nodes 10 time 1 pv d8h4 g2g3';

		expect(readEvaluation(ChessFen.parse(AFTER_E4), AFTER_E4, info)?.score).toEqual({
			unit: 'mate',
			value: -2,
		});
	});

	it('ignores bounds, progress lines and the final answer', () => {
		const position = ChessFen.initial();
		const fen = ChessFen.serialize(position);

		expect(
			readEvaluation(
				position,
				fen,
				'info depth 12 seldepth 16 multipv 1 score cp 40 lowerbound nodes 1 time 1 pv e2e4',
			),
		).toBeUndefined();
		expect(
			readEvaluation(position, fen, 'info depth 12 currmove e2e4 currmovenumber 1'),
		).toBeUndefined();
		expect(readEvaluation(position, fen, 'bestmove e2e4 ponder e7e5')).toBeUndefined();
	});
});

import { describe, expect, it } from 'vitest';

import { readGauge } from '@app/page/match/component/match-analysis/evaluation-gauge';
import { EngineEvaluation, EngineScore } from '@app/page/match/service/engine-evaluation';
import { ChessFen } from '@app/util/chess/chess-fen';

const POSITION = ChessFen.initial();

function evaluation(unit: EngineScore['unit'], value: number): EngineEvaluation {
	return { fen: '', depth: 18, score: { unit, value } };
}

describe('readGauge', () => {
	it('writes the lead with one decimal on the side ahead', () => {
		const white = readGauge('playing', POSITION, evaluation('cp', 134));
		const black = readGauge('playing', POSITION, evaluation('cp', -250));

		expect(white.leader).toBe('white');
		expect(white.label).toBe('+1.3');
		expect(white.whiteShare).toBeGreaterThan(50);
		expect(black.leader).toBe('black');
		expect(black.label).toBe('+2.5');
		expect(black.whiteShare).toBeLessThan(50);
	});

	it('calls a level position even, on white’s side', () => {
		expect(readGauge('playing', POSITION, evaluation('cp', -4))).toMatchObject({
			leader: 'white',
			label: '0.0',
		});
	});

	it('never lets a centipawn score empty either side', () => {
		expect(readGauge('playing', POSITION, evaluation('cp', 5000)).whiteShare).toBe(95);
		expect(readGauge('playing', POSITION, evaluation('cp', -5000)).whiteShare).toBe(5);
	});

	it('fills the bar for the side that mates', () => {
		expect(readGauge('playing', POSITION, evaluation('mate', 3))).toEqual({
			whiteShare: 100,
			leader: 'white',
			label: 'M3',
		});
		expect(readGauge('playing', POSITION, evaluation('mate', -2))).toEqual({
			whiteShare: 0,
			leader: 'black',
			label: 'M2',
		});
	});

	it('shows the result once the board is over', () => {
		expect(readGauge('checkmate', POSITION, undefined)).toEqual({
			whiteShare: 0,
			leader: 'black',
			label: '0-1',
		});
		expect(readGauge('stalemate', POSITION, evaluation('cp', 300))).toEqual({
			whiteShare: 50,
			leader: 'white',
			label: '½-½',
		});
	});

	it('waits at the middle with no label until the engine answers', () => {
		expect(readGauge('playing', POSITION, undefined)).toEqual({
			whiteShare: 50,
			leader: 'white',
			label: undefined,
		});
	});
});

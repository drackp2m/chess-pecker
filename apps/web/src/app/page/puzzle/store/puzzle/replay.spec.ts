import { describe, expect, it } from 'vitest';

import { Puzzle } from '@app/definition/puzzle.type';
import { foldExploration, foldOrBlank, foldRecord } from '@app/page/puzzle/store/puzzle/replay';
import { ChessFen } from '@app/util/chess/chess-fen';

const FEN = '5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27';

const PUZZLE: Puzzle = {
	id: 'JOGv3',
	fen: FEN,
	moves: ['f1f8', 'b2b1', 'b3d1', 'b1d1', 'f8f1', 'd1f1'],
	rating: 536,
	themes: ['mateIn3'],
	selectedFor: '500-599',
};

describe('foldRecord', () => {
	it('rebuilds the board a record describes', () => {
		const state = foldRecord(FEN, ['f1f8', 'b2b1']);

		expect(state.cursor).toBe(2);
		expect(state.positions).toHaveLength(3);
		expect(ChessFen.serialize(state.positions[0] ?? ChessFen.initial())).toBe(FEN);
	});

	it('reads the opponent off the side to move in the exercise itself', () => {
		const state = foldRecord(FEN, ['f1f8', 'b2b1']);

		expect(state.line.map((move) => move.isOpponent)).toEqual([true, false]);
		expect(state.line.map((move) => move.fullmoveNumber)).toEqual([27, 27]);
		expect(state.line.map((move) => move.san)).not.toContain('');
	});

	it('leaves the plies ahead of the cursor where a step back found them', () => {
		const state = foldRecord(FEN, ['f1f8', 'b2b1', -1]);

		expect(state.cursor).toBe(1);
		expect(state.line).toHaveLength(2);
	});

	it('throws on an event that does not replay', () => {
		expect(() => foldRecord(FEN, ['a1a2'])).toThrow();
	});
});

describe('foldOrBlank', () => {
	it('degrades a record that does not replay to the board it opened on', () => {
		const state = foldOrBlank(FEN, ['f1f8', 'a1a2']);

		expect(state.cursor).toBe(0);
		expect(state.line).toEqual([]);
		expect(ChessFen.serialize(state.positions[0] ?? ChessFen.initial())).toBe(FEN);
	});

	it('degrades to a blank board when even the exercise cannot be read', () => {
		const state = foldOrBlank('nonsense', ['f1f8']);

		expect(state.line).toEqual([]);
		expect(state.positions).toEqual([ChessFen.initial()]);
	});
});

describe('foldExploration', () => {
	it('hangs the exploration off the main line it was entered from', () => {
		const record = { record: ['f1f8', 'b2b1'], explorations: [{ at: 2, events: ['b3d1'] }] };

		const fold = foldExploration(FEN, record, 0, PUZZLE);

		expect(fold?.cursor).toBe(3);
		expect(fold?.anchor.cursor).toBe(2);
		expect(fold?.anchor.line).toHaveLength(2);
		expect(fold?.anchor.deviation).toBeUndefined();
	});

	it('works the deviation out again from the line the anchor holds', () => {
		const record = { record: ['f1f8', 'b2c2'], explorations: [{ at: 2, events: [] }] };

		expect(foldExploration(FEN, record, 0, PUZZLE)?.anchor.deviation).toBe(1);
	});

	it('has nothing to say about an exploration the record does not hold', () => {
		expect(foldExploration(FEN, { record: [], explorations: [] }, 0, PUZZLE)).toBeUndefined();
	});
});

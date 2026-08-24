import { describe, expect, it } from 'vitest';

import { ChessMove } from '@app/definition/chess.type';
import { PuzzleClosure } from '@app/definition/puzzle.type';
import { HINT, RecordState, append, blankRecord } from '@app/page/puzzle/store/puzzle/record';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessNotation } from '@app/util/chess/chess-notation';

const FEN = '5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27';

function move(uci: string): ChessMove {
	const parsed = ChessNotation.parse(ChessFen.parse(FEN), uci);

	if (undefined === parsed) {
		throw new Error(`${uci} is not legal in ${FEN}`);
	}

	return parsed;
}

function state(overrides: Partial<RecordState> = {}): RecordState {
	return { ...blankRecord(), freePlayIndex: undefined, closure: 'open', ...overrides };
}

describe('append', () => {
	it('writes a move onto the main line', () => {
		expect(append(state(), { kind: 'move', move: move('f1f8') }).record).toEqual(['f1f8']);
	});

	it('writes the hint and the restart as their own markers', () => {
		expect(append(state(), { kind: 'hint' }).record).toEqual([HINT]);
		expect(append(state(), { kind: 'restart' }).record).toEqual([0]);
	});

	it('joins a step to the run before it while both go the same way', () => {
		const stepped = append(state({ record: ['f1f8', -1] }), { kind: 'step', step: -1 });

		expect(stepped.record).toEqual(['f1f8', -2]);
	});

	/** Adding across a change of direction would land on `0`, which reads as a restart. */
	it('starts a new run when the direction changes', () => {
		const stepped = append(state({ record: ['f1f8', -1] }), { kind: 'step', step: 1 });

		expect(stepped.record).toEqual(['f1f8', -1, 1]);
	});

	it('leaves a restart standing rather than adding a step onto it', () => {
		const stepped = append(state({ record: [0] }), { kind: 'step', step: 1 });

		expect(stepped.record).toEqual([0, 1]);
	});

	it('takes no notice of a step that moved nothing', () => {
		const before = state({ record: ['f1f8'] });

		expect(append(before, { kind: 'step', step: 0 }).record).toEqual(['f1f8']);
	});

	it('opens a free-play run anchored to the length the main line had reached', () => {
		const entered = append(state({ record: ['f1f8', 'b2b1'] }), { kind: 'entry' });

		expect(entered.freePlayRuns).toEqual([{ at: 2, events: [] }]);
		expect(entered.record).toEqual(['f1f8', 'b2b1']);
	});

	it('writes into the open free-play run while free play is on', () => {
		const before = state({
			record: ['f1f8'],
			freePlayRuns: [{ at: 1, events: [] }],
			freePlayIndex: 0,
		});

		const written = append(before, { kind: 'move', move: move('f1f8') });

		expect(written.record).toEqual(['f1f8']);
		expect(written.freePlayRuns).toEqual([{ at: 1, events: ['f1f8'] }]);
	});

	it.each<PuzzleClosure>(['found', 'revealed'])(
		'writes nothing once the exercise is %s',
		(closure) => {
			const before = state({ record: ['f1f8'], closure });

			expect(append(before, { kind: 'move', move: move('b3d1') }).record).toEqual(['f1f8']);
			expect(append(before, { kind: 'hint' }).record).toEqual(['f1f8']);
			expect(append(before, { kind: 'entry' }).freePlayRuns).toEqual([]);
		},
	);
});

import { describe, expect, it } from 'vitest';

import { FreePlayRun, Puzzle, PuzzleEvent } from '@app/definition/puzzle.type';
import { Timeline } from '@app/definition/timeline.type';
import { foldRevealed, foldSession } from '@app/page/puzzle/store/puzzle/replay';
import {
	TimelineInput,
	projectTimeline,
	timelineMoves,
} from '@app/page/puzzle/store/puzzle/timeline';

const FEN = '5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27';

const PUZZLE: Puzzle = {
	id: 'JOGv3',
	fen: FEN,
	moves: ['f1f8', 'b2b1', 'b3d1', 'b1d1', 'f8f1', 'd1f1'],
	rating: 536,
	themes: ['mateIn3'],
	selectedFor: '500-599',
};

const ANSWER = ['b2b1', 'b3d1', 'b1d1', 'f8f1', 'd1f1'];

function timelineInput(
	record: readonly PuzzleEvent[],
	freePlayRuns: readonly FreePlayRun[] = [],
	over: Partial<TimelineInput> = {},
): TimelineInput {
	return {
		fen: FEN,
		record: { record, freePlayRuns },
		freePlayIndex: undefined,
		revealed: undefined,
		rewound: 0,
		puzzle: PUZZLE,
		...over,
	};
}

/** The moves behind the head, which is what the board is standing on. */
function headPath(timeline: Timeline): readonly string[] {
	return timelineMoves(timeline.lines, timeline.head.line)
		.slice(0, timeline.head.ply)
		.map((move) => move.san);
}

/** The same thing read off the fold the store already derives its board from. */
function foldedPath(input: TimelineInput): readonly string[] {
	const folded = foldRevealed(
		foldSession(input.fen, input.record, input.freePlayIndex, input.puzzle),
		input.revealed,
	);

	return folded.line.slice(0, Math.max(0, folded.cursor - input.rewound)).map((move) => move.san);
}

describe('projectTimeline', () => {
	it('grows a single main line while the record follows itself', () => {
		const timeline = projectTimeline(timelineInput(['f1f8', 'b2b1', 'b3d1']));

		expect(timeline.lines).toHaveLength(1);
		expect(timeline.lines[0]?.kind).toBe('main');
		expect(timeline.lines[0]?.moves.map((move) => move.san)).toEqual(['Rxf8', 'Rb1+', 'Bd1']);
		expect(timeline.head).toEqual({ line: 0, ply: 3 });
	});

	it('moves nothing at all for the hint marker', () => {
		const timeline = projectTimeline(timelineInput(['f1f8', '?', 'b2b1']));

		expect(timeline.lines).toHaveLength(1);
		expect(timeline.head).toEqual({ line: 0, ply: 2 });
	});

	it('leaves the move that was played over behind as a variation', () => {
		const timeline = projectTimeline(timelineInput(['f1f8', 'b2c2', -1, 'b2b1']));

		expect(timeline.lines[0]?.moves.map((move) => move.san)).toEqual(['Rxf8', 'Rb1+']);
		expect(timeline.lines[1]).toMatchObject({
			parent: 0,
			at: 1,
			kind: 'variation',
			run: undefined,
		});
		expect(timeline.lines[1]?.moves.map((move) => move.san)).toEqual(['Rc2']);
		expect(timeline.head).toEqual({ line: 0, ply: 2 });
	});

	it('does not branch when the move played again is the one that was there', () => {
		const timeline = projectTimeline(timelineInput(['f1f8', 'b2b1', -1, 'b2b1']));

		expect(timeline.lines).toHaveLength(1);
		expect(timeline.head).toEqual({ line: 0, ply: 2 });
	});

	it('stacks every alternative tried at the same ply in the order they were tried', () => {
		const timeline = projectTimeline(timelineInput(['f1f8', 'b2c2', -1, 'b2a2', -1, 'b2b1']));

		expect(timeline.lines).toHaveLength(3);
		expect(timeline.lines.map((line) => line.at)).toEqual([0, 1, 1]);
		expect(timeline.lines.map((line) => line.parent)).toEqual([undefined, 0, 0]);
		expect(timeline.lines.map((line) => line.moves.map((move) => move.san))).toEqual([
			['Rxf8', 'Rb1+'],
			['Rc2'],
			['Rxa2'],
		]);
	});

	it('walks back into a variation already played instead of writing it twice', () => {
		const timeline = projectTimeline(timelineInput(['f1f8', 'b2c2', -1, 'b2b1', -1, 'b2c2']));

		expect(timeline.lines).toHaveLength(2);
		expect(timeline.head).toEqual({ line: 1, ply: 2 });
		expect(headPath(timeline)).toEqual(['Rxf8', 'Rc2']);
	});

	it('stands the head back on the opening move when the record restarts', () => {
		const timeline = projectTimeline(timelineInput(['f1f8', 'b2b1', 'b3d1', 0]));

		expect(timeline.lines).toHaveLength(1);
		expect(timeline.lines[0]?.moves).toHaveLength(3);
		expect(timeline.head).toEqual({ line: 0, ply: 1 });
	});

	it('hangs a free-play run off the ply the main line was standing on', () => {
		const timeline = projectTimeline(
			timelineInput(['f1f8', 'b2b1'], [{ at: 2, events: ['f8f1'] }], { freePlayIndex: 0 }),
		);

		expect(timeline.lines[1]).toMatchObject({ parent: 0, at: 2, kind: 'freePlay', run: 0 });
		expect(timeline.lines[1]?.moves.map((move) => move.san)).toEqual(['Rf1']);
		expect(timeline.head).toEqual({ line: 1, ply: 3 });
	});

	it('leaves the head on the main line when the free-play run is not the open one', () => {
		const timeline = projectTimeline(
			timelineInput(['f1f8', 'b2b1'], [{ at: 2, events: ['f8f1'] }]),
		);

		expect(timeline.lines).toHaveLength(2);
		expect(timeline.head).toEqual({ line: 0, ply: 2 });
	});

	it('marks the entry of a free-play run that played nothing', () => {
		const timeline = projectTimeline(timelineInput(['f1f8', 'b2b1'], [{ at: 2, events: [] }]));

		expect(timeline.lines[1]).toMatchObject({ parent: 0, at: 2, kind: 'freePlay', run: 0 });
		expect(timeline.lines[1]?.moves).toEqual([]);
	});

	it('branches a free-play run off the main line again after a restart inside it', () => {
		const timeline = projectTimeline(
			timelineInput(['f1f8', 'b2b1'], [{ at: 2, events: [0, 'b2c2'] }], { freePlayIndex: 0 }),
		);

		expect(timeline.lines[2]).toMatchObject({ parent: 0, at: 1, kind: 'freePlay', run: 0 });
		expect(timeline.lines[2]?.moves.map((move) => move.san)).toEqual(['Rc2']);
		expect(timeline.lines[0]?.moves.map((move) => move.san)).toEqual(['Rxf8', 'Rb1+']);
		expect(headPath(timeline)).toEqual(['Rxf8', 'Rc2']);
	});

	it('turns the move that strayed into a variation when the answer is played out', () => {
		const timeline = projectTimeline(
			timelineInput(['f1f8', 'b2c2', -1], [], { revealed: { at: 1, moves: ANSWER } }),
		);

		expect(timeline.lines[0]?.moves).toHaveLength(6);
		expect(timeline.lines[1]?.moves.map((move) => move.san)).toEqual(['Rc2']);
		expect(timeline.lines[1]?.at).toBe(1);
		expect(timeline.head).toEqual({ line: 0, ply: 6 });
	});

	it('walks the head back over the plies the board is being held behind', () => {
		const timeline = projectTimeline(
			timelineInput(['f1f8', 'b2c2', -1], [], { revealed: { at: 1, moves: ANSWER }, rewound: 4 }),
		);

		expect(timeline.head).toEqual({ line: 0, ply: 2 });
		expect(headPath(timeline)).toEqual(['Rxf8', 'Rb1+']);
	});

	it('degrades to an empty main line when the record does not replay', () => {
		const timeline = projectTimeline(timelineInput(['f1f8', 'a1a2']));

		expect(timeline.lines).toEqual([
			{ id: 0, parent: undefined, at: 0, moves: [], kind: 'main', run: undefined },
		]);
		expect(timeline.head).toEqual({ line: 0, ply: 0 });
	});

	it('drops a free-play run that does not replay and keeps the main line', () => {
		const timeline = projectTimeline(
			timelineInput(['f1f8', 'b2b1'], [{ at: 2, events: ['a1a2'] }], { freePlayIndex: 0 }),
		);

		expect(timeline.lines).toHaveLength(1);
		expect(timeline.head).toEqual({ line: 0, ply: 2 });
	});
});

describe('timelineMoves', () => {
	it('reads a variation back as the whole line it is', () => {
		const timeline = projectTimeline(timelineInput(['f1f8', 'b2c2', -1, 'b2b1']));

		expect(timelineMoves(timeline.lines, 1).map((move) => move.san)).toEqual(['Rxf8', 'Rc2']);
	});

	it('has nothing to say about a line that is not there', () => {
		expect(timelineMoves([], 3)).toEqual([]);
	});
});

/**
 * The projection and the fold are two readings of one log, so the path behind the head has
 * to be the line the board is standing on, move for move.
 */
describe('the head path', () => {
	const cases: Record<string, TimelineInput> = {
		'a line that follows the script': timelineInput(['f1f8', 'b2b1', 'b3d1']),
		'a miss stepped back over and tried again': timelineInput(['f1f8', 'b2c2', -1, 'b2b1']),
		'a move played again after stepping back': timelineInput(['f1f8', 'b2b1', -1, 'b2b1']),
		'a walk back into an abandoned variation': timelineInput([
			'f1f8',
			'b2c2',
			-1,
			'b2b1',
			-1,
			'b2c2',
		]),
		'a restart': timelineInput(['f1f8', 'b2b1', 'b3d1', 0]),
		'a free-play run standing open': timelineInput(
			['f1f8', 'b2b1'],
			[{ at: 2, events: ['f8f1'] }],
			{
				freePlayIndex: 0,
			},
		),
		'a free-play run that was left': timelineInput(['f1f8', 'b2b1'], [{ at: 2, events: ['f8f1'] }]),
		'a free-play run restarted from inside': timelineInput(
			['f1f8', 'b2b1'],
			[{ at: 2, events: [0, 'b2c2'] }],
			{ freePlayIndex: 0 },
		),
		'a free-play run stepping along the main line': timelineInput(
			['f1f8', 'b2b1', 'b3d1'],
			[{ at: 3, events: [-2] }],
			{ freePlayIndex: 0 },
		),
		'an answer played out over a miss': timelineInput(['f1f8', 'b2c2', -1], [], {
			revealed: { at: 1, moves: ANSWER },
		}),
		'an answer stepped back through': timelineInput(['f1f8', 'b2c2', -1], [], {
			revealed: { at: 1, moves: ANSWER },
			rewound: 4,
		}),
		'a record that does not replay': timelineInput(['f1f8', 'a1a2']),
		'a free-play run that does not replay': timelineInput(
			['f1f8', 'b2b1'],
			[{ at: 2, events: ['a1a2'] }],
			{ freePlayIndex: 0 },
		),
	};

	for (const [name, input] of Object.entries(cases)) {
		it(`stands where the fold does for ${name}`, () => {
			expect(headPath(projectTimeline(input))).toEqual(foldedPath(input));
		});
	}
});

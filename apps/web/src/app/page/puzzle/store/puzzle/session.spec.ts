import { describe, expect, it } from 'vitest';

import { ChessMove } from '@app/definition/chess.type';
import { Puzzle } from '@app/definition/puzzle.type';
import { foldRecord } from '@app/page/puzzle/store/puzzle/replay';
import {
	FreePlayAnchor,
	LineState,
	anchorFreePlay,
	isSolution,
	openPuzzle,
	restoreFreePlayPatch,
} from '@app/page/puzzle/store/puzzle/session';
import { nextTransition } from '@app/util/chess/board-transition';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessNotation } from '@app/util/chess/chess-notation';

/** Two white queens; both `Qg7#` and `Qf8#` mate the king on h8, the white king
 * on h6 covering g7 and h7 in either case. */
const TWO_MATES = '7k/8/7K/8/8/8/8/5QQ1 w - - 0 1';

const MATE_IN_3 = '5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27';

function move(fen: string, uci: string): ChessMove {
	const parsed = ChessNotation.parse(ChessFen.parse(fen), uci);

	if (undefined === parsed) {
		throw new Error(`${uci} is not legal in ${fen}`);
	}

	return parsed;
}

/** The line a log describes, which is the only way one is built now. */
function buildLine(fen: string, notations: readonly string[]): LineState {
	return foldRecord(fen, notations);
}

describe('isSolution', () => {
	it('accepts the scripted move', () => {
		const position = ChessFen.parse(TWO_MATES);

		expect(isSolution(position, move(TWO_MATES, 'g1g7'), 'g1g7')).toBe(true);
	});

	it('accepts a different move that also mates', () => {
		const position = ChessFen.parse(TWO_MATES);

		expect(isSolution(position, move(TWO_MATES, 'f1f8'), 'g1g7')).toBe(true);
	});

	it('rejects a move that neither matches nor mates', () => {
		const position = ChessFen.parse(TWO_MATES);

		// Qf2 neither matches the script nor gives check.
		expect(isSolution(position, move(TWO_MATES, 'f1f2'), 'g1g7')).toBe(false);
	});

	it('rejects anything once the line is exhausted', () => {
		const position = ChessFen.parse(TWO_MATES);

		expect(isSolution(position, move(TWO_MATES, 'g1g7'), undefined)).toBe(false);
	});
});

describe('openPuzzle', () => {
	it('hands the player the colour that is not to move in the FEN', () => {
		const puzzle: Puzzle = {
			id: 'X',
			fen: '5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27',
			moves: ['f1f8', 'b2b1'],
			rating: 0,
			themes: [],
			selectedFor: '',
		};

		const opened = openPuzzle(puzzle);

		expect(opened.playerColor).toBe('black');
		expect(opened.orientation).toBe('black');
		expect(opened.outcome).toBe('opening');
		// The line is the log folded out, so opening one is emptying the log.
		expect(opened.record).toEqual([]);
		expect(opened.freePlayRuns).toEqual([]);
	});
});

describe('the free play anchor', () => {
	const LINE = buildLine(MATE_IN_3, ['f1f8', 'b2b1', 'b3d1', 'b1d1']);

	function restore(anchor: FreePlayAnchor, cursor: number) {
		return restoreFreePlayPatch({ cursor, transition: undefined }, anchor, false);
	}

	it('captures the line free play picked up, deviation and all', () => {
		expect(anchorFreePlay(LINE, 2)).toEqual({ ...LINE, deviation: 2 });
		expect(anchorFreePlay(LINE, undefined).deviation).toBeUndefined();
	});

	it('lets go of the free-play run rather than unwriting it', () => {
		const anchor = anchorFreePlay(LINE, undefined);
		const patch = restore(anchor, 6);

		expect(patch.freePlayIndex).toBeUndefined();
		// The line is derived now, so nothing here puts it back by hand.
		expect(patch).not.toHaveProperty('positions');
		expect(patch).not.toHaveProperty('line');
		expect(patch).not.toHaveProperty('cursor');
	});

	it('keeps the slide that lands on the cursor it restores, and drops any other', () => {
		const anchor = anchorFreePlay(LINE, undefined);
		const slide = nextTransition(ChessFen.parse(MATE_IN_3), move(MATE_IN_3, 'f1f8'), 'played');

		expect(restoreFreePlayPatch({ cursor: 4, transition: slide }, anchor, false).transition).toBe(
			slide,
		);
		expect(
			restoreFreePlayPatch({ cursor: 6, transition: slide }, anchor, false).transition,
		).toBeUndefined();
	});
});

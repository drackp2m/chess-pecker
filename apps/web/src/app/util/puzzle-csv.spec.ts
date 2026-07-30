import { describe, expect, it } from 'vitest';

import { PuzzleCsv } from '@app/util/puzzle-csv';

const HEADER = 'PuzzleId,FEN,Moves,Rating,Popularity,NbPlays,Themes,GameUrl,SelectedFor';
const ROW =
	'JOGv3,5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27,f1f8 b2b1 b3d1 b1d1 f8f1 d1f1,536,100,2178,backRankMate endgame long mate mateIn3,https://lichess.org/fFWULcre#53,500-599 / backRankMate / endgame';

describe('PuzzleCsv', () => {
	it('reads the sample row with its header', () => {
		const { puzzles, skipped } = PuzzleCsv.parse(`${HEADER}\n${ROW}`);

		expect(skipped).toBe(0);
		expect(puzzles).toHaveLength(1);
		expect(puzzles[0]).toEqual({
			id: 'JOGv3',
			fen: '5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27',
			moves: ['f1f8', 'b2b1', 'b3d1', 'b1d1', 'f8f1', 'd1f1'],
			rating: 536,
			themes: ['backRankMate', 'endgame', 'long', 'mate', 'mateIn3'],
			selectedFor: '500-599 / backRankMate / endgame',
		});
	});

	it('falls back to the published column order when there is no header', () => {
		const { puzzles } = PuzzleCsv.parse(ROW);

		expect(puzzles[0]?.id).toBe('JOGv3');
		expect(puzzles[0]?.rating).toBe(536);
	});

	it('matches columns by name, so order and extra columns do not matter', () => {
		const csv = [
			'Moves,Extra,PuzzleId,FEN',
			'f1f8,ignored,ABC12,5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27',
		].join('\n');
		const { puzzles } = PuzzleCsv.parse(csv);

		expect(puzzles[0]?.id).toBe('ABC12');
		expect(puzzles[0]?.moves).toEqual(['f1f8']);
		expect(puzzles[0]?.rating).toBe(0);
	});

	it('handles quoted fields with commas and escaped quotes', () => {
		const csv = `${HEADER}\nQ1,5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27,f1f8,10,20,30,"mate, short","https://x/?a=1,2","say ""hi"""`;
		const { puzzles } = PuzzleCsv.parse(csv);

		expect(puzzles[0]?.themes).toEqual(['mate,', 'short']);
		expect(puzzles[0]?.selectedFor).toBe('say "hi"');
	});

	it('drops unreadable rows and counts them', () => {
		const csv = [
			HEADER,
			ROW,
			'BAD,not-a-fen,e2e4,1,1,1,,,',
			'NOMOVES,8/8/8/8/8/8/8/K6k w - - 0 1,,1,1,1,,,',
		].join('\n');
		const { puzzles, skipped } = PuzzleCsv.parse(csv);

		expect(puzzles).toHaveLength(1);
		expect(skipped).toBe(2);
	});

	it('tolerates CRLF, blank lines and a trailing newline', () => {
		const { puzzles, skipped } = PuzzleCsv.parse(`${HEADER}\r\n${ROW}\r\n\r\n`);

		expect(puzzles).toHaveLength(1);
		expect(skipped).toBe(0);
	});

	it('returns nothing for empty input', () => {
		expect(PuzzleCsv.parse('')).toEqual({ puzzles: [], skipped: 0 });
	});
});

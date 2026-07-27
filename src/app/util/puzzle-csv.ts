import { Puzzle, PuzzleParseResult } from '@app/definition/puzzle.type';
import { ChessFen } from '@app/util/chess/chess-fen';

/** Column order of the published Lichess database, used when a file has no header. */
const DEFAULT_COLUMNS = [
	'puzzleid',
	'fen',
	'moves',
	'rating',
	'popularity',
	'nbplays',
	'themes',
	'gameurl',
	'selectedfor',
];

/**
 * Reads the Lichess puzzle CSV. A header row is honoured when present — columns are
 * then matched by name, so extra columns or a different order are fine — and falls
 * back to the published column order otherwise. Unreadable rows are counted and
 * dropped rather than failing the whole import.
 */
export abstract class PuzzleCsv {
	static parse(text: string): PuzzleParseResult {
		const rows = this.toRows(text).filter((row) => 0 < row.length && '' !== row[0]?.trim());

		if (0 === rows.length) {
			return { puzzles: [], skipped: 0 };
		}

		// A header is recognised by any cell naming a known column, not just the
		// first one, so a reordered export is still matched by name.
		const [first] = rows;
		const heading = undefined === first ? [] : this.toColumns(first);
		const hasHeader = heading.some((name) => DEFAULT_COLUMNS.includes(name));
		const columns = hasHeader ? heading : DEFAULT_COLUMNS;
		const body = hasHeader ? rows.slice(1) : rows;
		const puzzles: Puzzle[] = [];
		let skipped = 0;

		for (const row of body) {
			const puzzle = this.toPuzzle(row, columns);

			if (undefined === puzzle) {
				skipped++;

				continue;
			}

			puzzles.push(puzzle);
		}

		return { puzzles, skipped };
	}

	/**
	 * Splits RFC 4180 text: quoted fields may hold commas, newlines and `""`.
	 * Line endings are normalised up front so the scanner only ever sees `\n`.
	 */
	// ToDo => this is the scalability ceiling for the Woodpecker feature. Everything
	// is synchronous and fully materialised: the whole file is read into a string,
	// copied again by `replace`, accumulated character-by-character into `field`, and
	// every row of every column is kept as `string[][]` before a single puzzle is
	// built. The published Lichess database is ~5M rows / ~1GB — that freezes the tab
	// long before it runs out of memory, and `PuzzlePage.loadFile` reads it with
	// `file.text()`, which needs the entire file resident first.
	//
	// A Woodpecker set is only a few hundred exercises, so the fix is not a faster
	// parser but a narrower one: stream the file (`file.stream()`), parse in a worker
	// so the UI keeps painting, and stop at the number of rows the set actually needs
	// — with filtering by rating/theme applied during the scan rather than after it.
	private static toRows(text: string): string[][] {
		const source = text.replace(/\r\n?/g, '\n');
		const rows: string[][] = [];
		let row: string[] = [];
		let field = '';
		let isQuoted = false;

		for (let index = 0; index < source.length; index++) {
			const character = source.charAt(index);

			if (isQuoted) {
				const isEscapedQuote = '"' === character && '"' === source.charAt(index + 1);

				if (isEscapedQuote) {
					field += '"';
					index++;
				} else if ('"' === character) {
					isQuoted = false;
				} else {
					field += character;
				}

				continue;
			}

			if ('"' === character) {
				isQuoted = true;
			} else if (',' === character) {
				row.push(field);
				field = '';
			} else if ('\n' === character) {
				row.push(field);
				rows.push(row);
				row = [];
				field = '';
			} else {
				field += character;
			}
		}

		row.push(field);
		rows.push(row);

		return rows;
	}

	private static toColumns(header: readonly string[]): string[] {
		return header.map((name) => name.trim().toLowerCase().replace(/\s+/g, ''));
	}

	private static toPuzzle(row: readonly string[], columns: readonly string[]): Puzzle | undefined {
		const read = (name: string): string => (row[columns.indexOf(name)] ?? '').trim();
		const fen = read('fen');
		const moves = read('moves')
			.split(/\s+/)
			.filter((move) => '' !== move);
		const id = read('puzzleid');

		if ('' === id || 0 === moves.length || !ChessFen.isValid(fen)) {
			return undefined;
		}

		return {
			id,
			fen,
			moves,
			rating: this.toNumber(read('rating')),
			popularity: this.toNumber(read('popularity')),
			nbPlays: this.toNumber(read('nbplays')),
			themes: read('themes')
				.split(/\s+/)
				.filter((theme) => '' !== theme),
			gameUrl: read('gameurl'),
			selectedFor: read('selectedfor'),
		};
	}

	private static toNumber(value: string): number {
		const parsed = Number(value);

		return Number.isFinite(parsed) ? parsed : 0;
	}
}

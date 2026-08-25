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

/** The scanner's position mid-file: the row being built, and whether quotes are open. */
interface CsvScan {
	rows: string[][];
	row: string[];
	field: string;
	isQuoted: boolean;
}

/**
 * Reads the Lichess puzzle CSV, matching columns by name when a header is present and
 * falling back to the published order. Unreadable rows are counted and dropped.
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
	 * Splits RFC 4180 text: quoted fields may hold commas, newlines and `""`. Line endings are
	 * normalised up front so the scanner only ever sees `\n`.
	 */
	// ToDo => the scalability ceiling: everything is synchronous and fully materialised, so the
	// ~1GB Lichess database freezes the tab. Stream it in a worker and stop at the rows needed.
	private static toRows(text: string): string[][] {
		const source = text.replace(/\r\n?/g, '\n');
		const scan: CsvScan = { rows: [], row: [], field: '', isQuoted: false };

		for (let index = 0; index < source.length; index++) {
			const character = source.charAt(index);

			if (scan.isQuoted) {
				index += this.readQuoted(scan, character, source.charAt(index + 1));

				continue;
			}

			this.readUnquoted(scan, character);
		}

		scan.row.push(scan.field);
		scan.rows.push(scan.row);

		return scan.rows;
	}

	/**
	 * One character inside a quoted field: `""` is a literal quote, a lone quote closes it.
	 * Returns how many extra characters it swallowed.
	 */
	private static readQuoted(scan: CsvScan, character: string, next: string): number {
		if ('"' === character && '"' === next) {
			scan.field += '"';

			return 1;
		}

		if ('"' === character) {
			scan.isQuoted = false;
		} else {
			scan.field += character;
		}

		return 0;
	}

	/** Outside quotes a comma ends the field and a newline ends the row. */
	private static readUnquoted(scan: CsvScan, character: string): void {
		if ('"' === character) {
			scan.isQuoted = true;
		} else if (',' === character) {
			scan.row.push(scan.field);
			scan.field = '';
		} else if ('\n' === character) {
			scan.row.push(scan.field);
			scan.rows.push(scan.row);
			scan.row = [];
			scan.field = '';
		} else {
			scan.field += character;
		}
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
			themes: read('themes')
				.split(/\s+/)
				.filter((theme) => '' !== theme),
			selectedFor: read('selectedfor'),
		};
	}

	private static toNumber(value: string): number {
		const parsed = Number(value);

		return Number.isFinite(parsed) ? parsed : 0;
	}
}

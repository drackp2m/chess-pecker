import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const R = '\x1b[0m';
const B = '\x1b[1m';
const C = '\x1b[94m';
const G = '\x1b[92m';

/** One square of the strip, in the units the artwork was drawn in. */
const CELL = 42;

/** Left to right, the order the pieces sit in the sheet. */
const PIECES = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];

const svgDir = join(process.cwd(), 'apps', 'web', 'public', 'svg');
const sheetPath = join(svgDir, 'chess-set.svg');
const outDir = join(svgDir, 'chess');

const sheet = readFileSync(sheetPath, 'utf8');

const paths = [...sheet.matchAll(/<path\b[^>]*\sd="([^"]+)"/gu)].map((match) => match[1]);

if (0 === paths.length) {
	console.error(`❌ No <path> found in ${sheetPath}`);
	process.exit(1);
}

/**
 * Every path opens with a moveto the spec reads as absolute, and nothing crosses a cell
 * boundary, so that first pair alone says which piece a path belongs to.
 */
const HEAD = /^\s*([Mm])\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/u;

/** Trims the float noise that shifting by a whole number of cells cannot introduce. */
const round = (value) => Number(value.toFixed(4)).toString();

const cells = new Map();

for (const d of paths) {
	const head = HEAD.exec(d);

	if (null === head) {
		console.error(`❌ Unsupported path, does not start with a moveto: ${d.slice(0, 40)}…`);
		process.exit(1);
	}

	const x = Number(head[2]);
	const index = Math.floor(x / CELL);

	if (!PIECES[index]) {
		console.error(`❌ Path starting at x=${head[2]} falls outside the ${PIECES.length} cells`);
		process.exit(1);
	}

	const shifted = `${head[1]}${round(x - index * CELL)} ${round(Number(head[3]))}${d.slice(head[0].length)}`;

	cells.set(index, [...(cells.get(index) ?? []), shifted]);
}

// The sheet is only worth splitting while it still holds every piece: a short read
// would quietly leave the board with a stale file for whatever went missing.
const missing = PIECES.filter((_, index) => !cells.has(index));

if (0 < missing.length) {
	console.error(`❌ No artwork found for: ${missing.join(', ')}`);
	process.exit(1);
}

// The pieces are masks and only the alpha channel is read, so the fill sits once on the
// root. The 42×42 canvas stays: its padding is what keeps the pieces sharing a baseline.
for (const [index, list] of [...cells].sort(([a], [b]) => a - b)) {
	const body = list.map((d) => `<path d="${d}"/>`).join('');
	const file = join(outDir, `${PIECES[index]}.svg`);

	writeFileSync(
		file,
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CELL} ${CELL}" fill="#000">${body}</svg>\n`,
		'utf8',
	);

	console.log(`✏️  ${B}${C}${PIECES[index]}${R} → ${file} ${G}(${list.length} paths)${R}`);
}

// Anything else in there is a piece the sheet no longer draws.
const stale = readdirSync(outDir).filter(
	(name) => name.endsWith('.svg') && !PIECES.includes(name.slice(0, -4)),
);

for (const name of stale) {
	unlinkSync(join(outDir, name));

	console.log(`🗑️  Removed stale ${B}${name}${R}`);
}

console.log(`✅ Split ${B}${G}${PIECES.length}${R} pieces out of chess-set.svg`);

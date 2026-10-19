import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Resvg } from '@resvg/resvg-js';

const CELL = 128;
const COLUMNS = 8;
const LABEL = 18;
const PADDING = 24;

const tile = (dir, file, index) => {
	const source = readFileSync(join(dir, file), 'utf8');
	const open = /<svg[^>]*>/u.exec(source)[0];
	const body = source.slice(source.indexOf(open) + open.length, source.lastIndexOf('</svg>'));
	const viewBox = /viewBox="([^"]+)"/u.exec(open)?.[1] ?? '0 0 512 512';
	const x = (index % COLUMNS) * CELL;
	const y = Math.floor(index / COLUMNS) * (CELL + LABEL);
	const box = `x="${x + PADDING}" y="${y + PADDING}" width="${CELL - PADDING * 2}"`;
	const label = `x="${x + CELL / 2}" y="${y + CELL + 6}" text-anchor="middle"`;

	return (
		`<rect ${box} height="${CELL - PADDING * 2}" fill="#eef"/>` +
		`<svg ${box} height="${CELL - PADDING * 2}" viewBox="${viewBox}">${body}</svg>` +
		`<text ${label} font-size="11" font-family="sans-serif">${file.slice(0, -4)}</text>`
	);
};

export const writePreview = (dir, output) => {
	const files = readdirSync(dir)
		.filter((file) => file.endsWith('.svg'))
		.sort();
	const width = COLUMNS * CELL;
	const height = Math.ceil(files.length / COLUMNS) * (CELL + LABEL);
	const tiles = files.map((file, index) => tile(dir, file, index)).join('');
	const sheet =
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
		`<rect width="100%" height="100%" fill="#fff"/>${tiles}</svg>`;

	writeFileSync(output, new Resvg(sheet, { font: { loadSystemFonts: true } }).render().asPng());
};

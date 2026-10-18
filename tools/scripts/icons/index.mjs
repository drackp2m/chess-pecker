import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { ICONS } from './icons.mjs';
import { toSvg } from './path-data.mjs';
import { writePreview } from './preview.mjs';

const R = '\x1b[0m';
const B = '\x1b[1m';
const D = '\x1b[90m';
const C = '\x1b[94m';
const G = '\x1b[92m';
const Y = '\x1b[93m';

const WEB_DIR = join(process.cwd(), 'apps', 'web');
const OUT_DIR = join(WEB_DIR, 'public', 'svg', 'icon');
const SVG_COMPONENT = join(WEB_DIR, 'src', 'app', 'component', 'svg', 'svg.component.ts');
const DEFAULT_PREVIEW = join(tmpdir(), 'chesspecker-icons.png');

const args = process.argv.slice(2);
const preview = args.find((arg) => arg.startsWith('--preview'));
const previewPath = preview?.split('=')[1] ?? DEFAULT_PREVIEW;
const names = args.filter((arg) => !arg.startsWith('--'));
const unknown = names.filter((name) => !Object.hasOwn(ICONS, name));

if (0 < unknown.length) {
	console.error(`❌ Unknown icon: ${unknown.join(', ')}`);
	console.error(`${D}Known: ${Object.keys(ICONS).join(', ')}${R}`);
	process.exit(1);
}

const selected = 0 === names.length ? Object.keys(ICONS) : names;
const aspectTable = readFileSync(SVG_COMPONENT, 'utf8');

mkdirSync(OUT_DIR, { recursive: true });

for (const name of selected) {
	const { width, height, draw } = ICONS[name];
	const file = join(OUT_DIR, `${name}.svg`);
	const svg = toSvg(width, height, draw());
	const size = `${width}×${height} ${svg.length} B`;

	writeFileSync(file, svg);
	console.log(`${C}${relative(process.cwd(), file)}${R} ${D}${size}${R}`);

	if (width !== height && !aspectTable.includes(`'${name}'`)) {
		console.log(`  ${Y}⚠ not square — add it to ASPECT_RATIOS as [${width}, ${height}]${R}`);
	}
}

console.log(`\n${B}${selected.length} icon${1 === selected.length ? '' : 's'}${R} ${G}written${R}`);

if (undefined !== preview) {
	writePreview(OUT_DIR, previewPath);
	console.log(`${D}Preview:${R} ${previewPath}`);
}

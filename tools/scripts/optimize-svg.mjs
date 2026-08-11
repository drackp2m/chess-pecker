import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const R = '\x1b[0m';
const B = '\x1b[1m';
const D = '\x1b[90m';
const C = '\x1b[94m';
const G = '\x1b[92m';
const Y = '\x1b[93m';

const DEFAULT_TARGET = 'apps/web/public';

const DROPPED_ELEMENTS = ['metadata', 'title', 'desc', 'sodipodi:namedview'];

const EDITOR_NAMESPACE =
	/^(?:inkscape|sodipodi|serif|figma|krita|vectornator|xmlns:(?:inkscape|sodipodi|dc|cc|rdf|serif|figma|vectornator)):/u;

const DROPPED_ATTRIBUTES = /^(?:data-name|version|enable-background|baseProfile)$/u;

const EMPTIABLE_ATTRIBUTES = /^(?:class|style|id|fill|stroke|transform)$/u;

const PATH_ATTRIBUTES = /^(?:d|points)$/u;

const TRANSFORM_ATTRIBUTES = /^(?:transform|gradientTransform|patternTransform)$/u;

const TEXT_ELEMENTS = /^<\/?(?:text|tspan|textPath|tref)\b/u;

const MASK_PATTERN = /@@@(\d+)@@@/gu;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const keepIds = args.includes('--keep-ids');
const precisionAt = args.indexOf('--precision');
const precision = -1 === precisionAt ? null : Number(args[precisionAt + 1] ?? 2);
const targets = args.filter(
	(arg, index) => !arg.startsWith('--') && (-1 === precisionAt || index !== precisionAt + 1),
);

if (null !== precision && (!Number.isInteger(precision) || 0 > precision)) {
	console.error('❌ --precision needs a non-negative integer');
	process.exit(1);
}

const splitNodes = (source) => {
	const nodes = [];
	let index = 0;

	while (index < source.length) {
		const open = source.indexOf('<', index);

		if (-1 === open) {
			nodes.push({ tag: false, value: source.slice(index) });

			break;
		}

		if (open > index) {
			nodes.push({ tag: false, value: source.slice(index, open) });
		}

		let cursor = open + 1;
		let quote = '';

		while (cursor < source.length && ('' !== quote || '>' !== source[cursor])) {
			const char = source[cursor];

			if ('' !== quote) {
				quote = char === quote ? '' : quote;
			} else if ('"' === char || "'" === char) {
				quote = char;
			}

			cursor += 1;
		}

		nodes.push({ tag: true, value: source.slice(open, cursor + 1) });
		index = cursor + 1;
	}

	return nodes;
};

const maskBlocks = (source, blocks) =>
	source.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/giu, (match) => {
		blocks.push(match);

		return `@@@${blocks.length - 1}@@@`;
	});

const restoreBlocks = (source, blocks) =>
	source.replace(MASK_PATTERN, (_, index) => blocks[Number(index)]);

const collectReferences = (source) => {
	const used = new Set();
	const styles = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/giu)]
		.map((match) => match[1])
		.join('\n');

	for (const match of source.matchAll(/url\(\s*['"]?#([^'")\s]+)/gu)) {
		used.add(match[1]);
	}

	for (const match of source.matchAll(/(?:xlink:)?href\s*=\s*["']#([^"']+)["']/gu)) {
		used.add(match[1]);
	}

	for (const match of styles.matchAll(/#([A-Za-z_][-\w]*)/gu)) {
		used.add(match[1]);
	}

	return used;
};

const shortenColor = (value) =>
	value.replace(/#([\da-f])\1([\da-f])\2([\da-f])\3\b/giu, (_, r, g, b) =>
		`#${r}${g}${b}`.toLowerCase(),
	);

const roundNumbers = (value) =>
	null === precision
		? value
		: value.replace(/-?\d*\.\d+(?:e[-+]?\d+)?/giu, (number) =>
				Number(Number(number).toFixed(precision)).toString(),
			);

const compact = (value) => roundNumbers(value).trim().replace(/\s+/gu, ' ');

const compactPath = (value) =>
	compact(value)
		.replace(/\s*([A-DF-Za-df-z])\s*/gu, '$1')
		.replace(/(\d)\s+-/gu, '$1-')
		.replace(/([\s,(])0\./gu, '$1.')
		.replace(/-0\./gu, '-.');

const cleanValue = (key, value) => {
	if (PATH_ATTRIBUTES.test(key)) {
		return compactPath(value);
	}

	if (TRANSFORM_ATTRIBUTES.test(key)) {
		return compact(value).replace(/\)\s+(?=[a-z])/giu, ')');
	}

	return shortenColor(compact(value));
};

const isDropped = (key, value, used) => {
	if (EDITOR_NAMESPACE.test(key) || DROPPED_ATTRIBUTES.test(key)) {
		return true;
	}

	if ('id' === key && !keepIds && !used.has(value)) {
		return true;
	}

	return '' === value.trim() && EMPTIABLE_ATTRIBUTES.test(key);
};

const cleanTag = (tag, used) => {
	const name = /^<\/?\s*([^\s/>]+)/u.exec(tag)?.[1] ?? '';

	if (tag.startsWith('</')) {
		return `</${name}>`;
	}

	const attributes = [];

	for (const [, key, raw] of tag.matchAll(/([^\s=/<>]+)\s*=\s*("[^"]*"|'[^']*'|[^\s/>]+)/gu)) {
		const value = raw.replace(/^["']|["']$/gu, '');

		if (isDropped(key, value, used)) {
			continue;
		}

		attributes.push(`${key}="${cleanValue(key, value)}"`);
	}

	const body = [name, ...attributes].join(' ');

	return /\/>$/u.test(tag) ? `<${body}/>` : `<${body}>`;
};

const dropElements = (source) =>
	DROPPED_ELEMENTS.reduce(
		(current, tag) =>
			current
				.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'giu'), '')
				.replace(new RegExp(`<${tag}\\b[^>]*/>`, 'giu'), ''),
		source,
	);

const cleanNodes = (source, used) => {
	let depth = 0;

	return splitNodes(source)
		.map((node) => {
			if (!node.tag) {
				return 0 === depth ? node.value.replace(/^\s+$/u, '') : node.value;
			}

			if (TEXT_ELEMENTS.test(node.value)) {
				depth += node.value.startsWith('</') ? -1 : 1;
			}

			return cleanTag(node.value, used);
		})
		.join('');
};

const dropUnusedXlink = (source) => {
	const stripped = source.replace(/\sxmlns:xlink="[^"]*"/gu, '');

	return stripped.includes('xlink:') ? source : stripped;
};

const optimize = (source) => {
	const blocks = [];
	let next = maskBlocks(source, blocks)
		.replace(/<!--[\s\S]*?-->/gu, '')
		.replace(/<\?[\s\S]*?\?>/gu, '')
		.replace(/<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?>/giu, '');

	next = dropElements(next);
	next = cleanNodes(next, collectReferences(restoreBlocks(next, blocks)));
	next = next.replace(/<(defs|g)(\s[^>]*)?>\s*<\/\1>/gu, '');
	next = next.replace(/@@@(\d+)@@@/gu, (mask, index) =>
		/>\s*<\//u.test(blocks[Number(index)]) ? '' : mask,
	);

	return `${dropUnusedXlink(restoreBlocks(next, blocks)).trim()}\n`;
};

const listSvgFiles = (target) => {
	const path = resolve(process.cwd(), target);

	if (!statSync(path).isDirectory()) {
		return '.svg' === extname(path) ? [path] : [];
	}

	return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
		listSvgFiles(join(path, entry.name)),
	);
};

const roots = 0 === targets.length ? [DEFAULT_TARGET] : targets;
const files = roots.flatMap(listSvgFiles).sort();

if (0 === files.length) {
	console.error(`❌ No .svg found in ${roots.join(', ')}`);
	process.exit(1);
}

const format = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const percent = (part, whole) => (0 === whole ? '0.0' : ((part / whole) * 100).toFixed(1));

const embeddedBytes = (source) =>
	[...source.matchAll(/data:[a-z-]+\/[a-z+.-]+;base64,([^"')\s]+)/giu)].reduce(
		(total, match) => total + match[1].length,
		0,
	);

let before = 0;
let after = 0;

for (const file of files) {
	const source = readFileSync(file, 'utf8');
	const result = optimize(source);
	const embedded = embeddedBytes(source);
	const saved = source.length - result.length;
	const name = relative(process.cwd(), file);
	const change =
		0 >= saved
			? `${D}unchanged${R}`
			: `${G}-${format(saved)} (${percent(saved, source.length)}%)${R}`;

	before += source.length;
	after += result.length;

	if (!dryRun && result !== source) {
		writeFileSync(file, result);
	}

	console.log(
		`${C}${name}${R} ${D}${format(source.length)} →${R} ${format(result.length)}  ${change}`,
	);

	if (embedded > result.length / 2) {
		const share = percent(embedded, result.length);

		console.log(`  ${Y}⚠ ${share}% is an embedded base64 raster — re-export it as vector${R}`);
	}
}

const total = before - after;
const note = dryRun ? ` ${Y}(dry run, nothing written)${R}` : '';
const label = `${files.length} file${1 === files.length ? '' : 's'}`;

console.log(
	`\n${B}${label}${R} ${format(before)} → ${format(after)} ${G}-${format(total)} (${percent(total, before)}%)${R}${note}`,
);

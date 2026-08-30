#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectUsages, readScopes } from '../catalogue/collect.mjs';
import { DEFAULTS } from '../catalogue/config.mjs';
import { readContext, termsIn } from '../catalogue/context.mjs';
import { hashOf } from '../catalogue/freshness.mjs';
import { buildExport } from '../transfer/build.mjs';
import { buildXliff } from '../transfer/xliff.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ICU_FILE = 'bench-icu';
const ORIGINAL = 'tools/scripts/i18n/bench/bench.json';
const FILE_LEVELS = new Set(['app', 'language']);

const load = (...names) => JSON.parse(readFileSync(path.join(DIR, ...names), 'utf8'));

const bench = load('bench.json');

function idsByKey(scopes) {
	const ids = new Map();

	for (const scope of scopes) {
		for (const entry of scope.keys?.entries ?? []) {
			ids.set(`${scope.name}.${entry.name}`, entry.value);
		}
	}

	return ids;
}

function wantedIds(ids) {
	const wanted = new Map();

	for (const { key } of bench.real) {
		const id = ids.get(key);

		if (undefined === id) {
			throw new Error(`bench.json names ${key}, which is not in the catalogue`);
		}

		wanted.set(id, key);
	}

	return wanted;
}

function pickedFiles(document, wanted, gold) {
	return document.files
		.map((file) => ({
			...file,
			units: file.units
				.filter((unit) => wanted.has(unit.id))
				.map((unit) => ({ ...unit, target: gold[wanted.get(unit.id)] ?? '' })),
		}))
		.filter((file) => 0 !== file.units.length);
}

const termLine = (term, lang) => {
	const target = term.translations?.[lang];
	const note = undefined === term.note ? '' : ` — ${term.note}`;

	return `${term.term}${undefined === target ? '' : ` → ${target}`}${note}`;
};

function glossaryNotes(context, lang, sources) {
	const { glossary } = context;
	const lines = termsIn(glossary, sources).map((term) => termLine(term, lang));
	const keep = glossary.keep ?? [];

	if (0 !== keep.length) {
		lines.push(`No traducir nunca: ${keep.join(', ')}`);
	}

	return 0 === lines.length ? [] : [{ category: 'glossary', text: lines.join('\n') }];
}

function icuNotes(entry, category, examples) {
	const kind = 'plural' === entry.kind ? 'examples' : 'gender-note';

	return [
		{ category: 'key', text: entry.key },
		{ category: 'category', text: `${entry.kind}:${category}` },
		{ category: kind, text: examples },
		{ category: 'siblings', text: entry.siblings },
		{ category: 'context', text: entry.context },
		{ category: 'srcHash', text: hashOf(entry.source) },
	];
}

function icuUnits(entry, lang, gold) {
	return Object.entries(entry.categories[lang] ?? {}).map(([category, examples]) => {
		const id = `${entry.key}#${entry.kind}:${category}`;

		return {
			id,
			notes: icuNotes(entry, category, examples),
			source: entry.source,
			target: gold[id] ?? '',
		};
	});
}

function icuFile(context, lang, gold) {
	const units = bench.icu.flatMap((entry) => icuUnits(entry, lang, gold));
	const shared = context
		.contextFor(DEFAULTS.rootScope, '', lang)
		.filter((layer) => FILE_LEVELS.has(layer.level))
		.map(({ level, text }) => ({ category: level, text }));
	const sources = units.map((unit) => unit.source);

	return {
		id: ICU_FILE,
		original: ORIGINAL,
		notes: [
			...shared,
			{ category: 'scope', text: bench.icuScope },
			...glossaryNotes(context, lang, sources),
		],
		units,
	};
}

function missing(files, gold, wanted) {
	const written = new Set(
		files.flatMap((file) => file.units.map((unit) => wanted.get(unit.id) ?? unit.id)),
	);
	const holes = files.flatMap((file) =>
		file.units.filter((unit) => '' === unit.target).map((unit) => wanted.get(unit.id) ?? unit.id),
	);
	const spare = Object.keys(gold).filter((key) => !written.has(key));

	return { holes, spare };
}

const blanked = (files) =>
	files.map((file) => ({
		...file,
		units: file.units.map((unit) => ({ ...unit, target: '', state: 'initial' })),
	}));

function write(lang, files, defaultLang) {
	const xliff = (blocks) => buildXliff({ srcLang: defaultLang, trgLang: lang, files: blocks });

	writeFileSync(path.join(DIR, `${lang}.xlf`), xliff(files), 'utf8');
	writeFileSync(path.join(DIR, `${lang}.blank.xlf`), xliff(blanked(files)), 'utf8');
}

function report(lang, files, gold, wanted) {
	const total = files.reduce((count, file) => count + file.units.length, 0);
	const { holes, spare } = missing(files, gold, wanted);

	console.log(`  ${lang}: ${total} unidades en ${files.length} bloques`);

	for (const id of holes) {
		console.log(`    ✖ sin traducción buena: ${id}`);
	}

	for (const id of spare) {
		console.log(`    ⚠ sobra en gold/${lang}.json: ${id}`);
	}

	return 0 === holes.length;
}

const options = { ...DEFAULTS };
const scopes = readScopes(options);
const context = readContext(options);
const { usages } = collectUsages(options.sourceDirs);
const wanted = wantedIds(idsByKey(scopes));

let complete = true;

for (const lang of bench.langs) {
	const gold = load('gold', `${lang}.json`);
	const document = buildExport({ ...options, scopes, lang, usages, context, blank: true });
	const files = [...pickedFiles(document, wanted, gold), icuFile(context, lang, gold)];

	write(lang, files, options.defaultLang);
	complete = report(lang, files, gold, wanted) && complete;
}

process.exit(complete ? 0 : 1);

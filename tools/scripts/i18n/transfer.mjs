import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { isUlid } from './config.mjs';
import { paramsFile, readDeclaredParams } from './params.mjs';
import { buildXliff } from './xliff.mjs';

export const DEFAULT_OUT_DIR = 'translations';

export const xliffFileName = (lang) => `${lang}.xlf`;

function relativise(file, root) {
	if (null === root || undefined === file || null === file) {
		return file;
	}

	return path.relative(root, file);
}

const usageNote = (usages, scope, name, root) => {
	const files = usages?.get(`${scope}:${name}`) ?? [];

	if (0 === files.length) {
		return [];
	}

	const text = [...new Set(files)].map((file) => relativise(file, root)).join(', ');

	return [{ category: 'usage', text }];
};

const paramNote = (declared, key) => {
	const fields = declared.get(key);

	if (undefined === fields) {
		return [];
	}

	const text = [...fields].map(([name, type]) => `{{ ${name} }}: ${type}`).join(', ');

	return [{ category: 'param', text }];
};

// Everything the translator needs to place the string without opening the repo:
// the constant they would type in the code, where it is rendered, and the type
// behind each placeholder.
function notesFor(scope, entry, context) {
	return [
		{ category: 'key', text: `${scope.keys.constName}.${entry.name}` },
		...paramNote(context.declared, entry.value),
		...usageNote(context.usages, scope.name, entry.name, context.root),
	];
}

function unitsOf(scope, { defaultLang, lang, missingOnly, usages, root }) {
	const source = scope.translations.get(defaultLang)?.data ?? {};
	const target = scope.translations.get(lang)?.data ?? {};
	const declared = readDeclaredParams(paramsFile(scope.dir));
	const context = { declared, usages, root };

	return scope.keys.entries
		.filter((entry) => isUlid(entry.ulid))
		.map((entry) => ({
			id: entry.value,
			notes: notesFor(scope, entry, context),
			source: source[entry.ulid] ?? '',
			target: target[entry.ulid] ?? '',
		}))
		.filter((unit) => !missingOnly || '' === String(unit.target).trim());
}

export function buildExport(options) {
	const { scopes, defaultLang, lang, missingOnly, usages, only, root = null } = options;
	const wanted = scopes.filter(
		(scope) => scope.keys && (!only?.length || only.includes(scope.name)),
	);
	const files = wanted
		.map((scope) => ({
			id: scope.name,
			original: relativise(scope.translations.get(lang)?.file ?? scope.keysFile, root),
			units: unitsOf(scope, { defaultLang, lang, missingOnly, usages, root }),
		}))
		.filter((file) => 0 !== file.units.length);

	const total = files.reduce((count, file) => count + file.units.length, 0);
	const untranslated = files.reduce(
		(count, file) => count + file.units.filter((unit) => '' === unit.target.trim()).length,
		0,
	);

	return {
		lang,
		files,
		total,
		untranslated,
		content: buildXliff({ srcLang: defaultLang, trgLang: lang, files }),
	};
}

export function writeExport(document, outDir) {
	const file = path.join(outDir, xliffFileName(document.lang));

	mkdirSync(outDir, { recursive: true });
	writeFileSync(file, document.content, 'utf8');

	return { ...document, file };
}

export function exportLangs({ langs, defaultLang }, requested) {
	const targets = requested?.length ? requested : langs.filter((lang) => lang !== defaultLang);
	const unknown = targets.filter((lang) => !langs.includes(lang));

	if (0 !== unknown.length) {
		throw new Error(`unknown language(s): ${unknown.join(', ')}`);
	}

	return targets.filter((lang) => lang !== defaultLang);
}

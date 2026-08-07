import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PARAM_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;
const ENTRY_LINE = /^\t'([^']+)': \{$/;
const FIELD_LINE = /^\t\t(\w+): (.+);$/;
const EMPTY = 'export type I18nParams = Record<never, never>;\n';

export const paramsFile = (i18nDir) => path.join(i18nDir, 'params.ts');

export function readDeclaredParams(file) {
	const declared = new Map();

	if (!existsSync(file)) {
		return declared;
	}

	let current = null;

	for (const line of readFileSync(file, 'utf8').split('\n')) {
		const entry = ENTRY_LINE.exec(line);
		const field = FIELD_LINE.exec(line);

		if (entry) {
			current = new Map();
			declared.set(entry[1], current);
		} else if (field && current) {
			current.set(field[1], field[2]);
		}
	}

	return declared;
}

function namesOf(text) {
	return [...new Set([...String(text).matchAll(PARAM_PATTERN)].map(([, name]) => name))];
}

function collectEntries(scopes, defaultLang) {
	const entries = [];

	for (const scope of scopes.filter((item) => item.keys)) {
		const data = scope.translations.get(defaultLang)?.data ?? {};

		for (const entry of scope.keys.entries) {
			const names = namesOf(data[entry.ulid] ?? '');

			if (names.length) {
				entries.push({ key: entry.value, names });
			}
		}
	}

	return entries;
}

function render(entries, declared) {
	if (!entries.length) {
		return EMPTY;
	}

	const body = entries.map(({ key, names }) => {
		const fields = names.map((name) => `\t\t${name}: ${declared.get(key)?.get(name) ?? 'string'};`);

		return [`\t'${key}': {`, ...fields, '\t};'].join('\n');
	});

	return `export interface I18nParams {\n${body.join('\n')}\n}\n`;
}

export function buildParams({ scopes, i18nDir, defaultLang }) {
	const file = paramsFile(i18nDir);
	const content = render(collectEntries(scopes, defaultLang), readDeclaredParams(file));
	const current = existsSync(file) ? readFileSync(file, 'utf8') : null;

	return { file, content, stale: content !== current };
}

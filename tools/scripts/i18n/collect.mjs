import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { DEFAULTS, toKebabCase } from './config.mjs';

const SOURCE_EXTENSIONS = new Set(['.ts', '.html']);
const CONST_USAGE = /\b([A-Z][A-Za-z0-9]*)I18n\s*\.\s*([A-Z][A-Z0-9_]*)\b/g;
const BARREL_USAGE = /\bI18n\s*\.\s*([a-z][A-Za-z0-9]*)\s*\.\s*([A-Z][A-Z0-9_]*)\b/g;

export const USAGE_PATTERNS = [CONST_USAGE, BARREL_USAGE];

function collectEntries(source) {
	const entries = [];

	const visit = (node) => {
		if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.initializer)) {
			entries.push({
				name: node.name.getText(source),
				value: node.initializer.text,
				ulid: node.initializer.text.split('.').pop(),
				line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
			});
		}

		ts.forEachChild(node, visit);
	};

	visit(source);

	return entries;
}

function findConstName(source) {
	for (const statement of source.statements) {
		if (!ts.isVariableStatement(statement)) {
			continue;
		}

		const [declaration] = statement.declarationList.declarations;

		if (declaration && ts.isIdentifier(declaration.name)) {
			return declaration.name.text;
		}
	}

	return null;
}

function readKeysFile(file) {
	const content = readFileSync(file, 'utf8');
	const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

	return { constName: findConstName(source), entries: collectEntries(source) };
}

function readTranslation(file) {
	if (!existsSync(file)) {
		return { exists: false, data: null, error: null };
	}

	try {
		return { exists: true, data: JSON.parse(readFileSync(file, 'utf8')), error: null };
	} catch (error) {
		return { exists: true, data: null, error: error.message };
	}
}

function readScope(dir, name, langs, prefixed) {
	const keysFile = path.join(dir, 'keys.ts');
	const translations = new Map();

	for (const lang of langs) {
		const file = path.join(dir, `${lang}.json`);

		translations.set(lang, { file, ...readTranslation(file) });
	}

	return {
		name,
		dir,
		keysFile,
		prefixed,
		keys: existsSync(keysFile) ? readKeysFile(keysFile) : null,
		translations,
	};
}

export function readScopes({ i18nDir, langs, rootScope = DEFAULTS.rootScope }) {
	if (!existsSync(i18nDir)) {
		return [];
	}

	const nested = readdirSync(i18nDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => readScope(path.join(i18nDir, entry.name), entry.name, langs, true));

	if (!existsSync(path.join(i18nDir, 'keys.ts'))) {
		return nested;
	}

	return [readScope(i18nDir, rootScope, langs, false), ...nested];
}

function* walkSources(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			if ('node_modules' !== entry.name) {
				yield* walkSources(full);
			}

			continue;
		}

		if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
			yield full;
		}
	}
}

function recordUsages(content, file, usages) {
	const add = (scope, key) => {
		const id = `${scope}:${key}`;

		usages.set(id, [...(usages.get(id) ?? []), file]);
	};

	for (const pattern of USAGE_PATTERNS) {
		for (const [, scopeToken, key] of content.matchAll(pattern)) {
			add(toKebabCase(scopeToken), key);
		}
	}
}

export function collectUsages(sourceDirs) {
	const usages = new Map();

	for (const dir of sourceDirs.filter((entry) => existsSync(entry))) {
		for (const file of walkSources(dir)) {
			recordUsages(readFileSync(file, 'utf8'), file, usages);
		}
	}

	return usages;
}

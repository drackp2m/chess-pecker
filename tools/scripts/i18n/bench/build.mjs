#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readScopes } from '../catalogue/collect.mjs';
import { DEFAULTS } from '../catalogue/config.mjs';
import { readContext } from '../catalogue/context.mjs';
import { buildExport } from '../transfer/build.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '..', '..', '..', '..');
const LIVE_I18N = path.resolve(ROOT, DEFAULTS.i18nDir);
const ROOT_SCOPE = 'common';

const snapshot = JSON.parse(readFileSync(path.join(DIR, 'snapshot.json'), 'utf8'));

const valueOf = (scope, key) => (scope.prefixed ? `${scope.name}.${key.id}` : key.id);

const scopeDir = (base, scope) => (ROOT_SCOPE === scope.name ? base : path.join(base, scope.name));

function keysFile(scope) {
	const lines = scope.keys.map((key) => `\t${key.name}: '${valueOf(scope, key)}',`);

	return [`export const ${scope.const} = {`, ...lines, '} as const;', ''].join('\n');
}

function paramsFile(scope) {
	const entries = scope.keys
		.filter((key) => undefined !== key.params)
		.flatMap((key) => [
			`\t'${valueOf(scope, key)}': {`,
			...Object.entries(key.params).map(([name, type]) => `\t\t${name}: ${type};`),
			'\t};',
		]);

	return [`export interface ${scope.const}Params {`, ...entries, '}', ''].join('\n');
}

function sourcesOf(scope) {
	return Object.fromEntries(scope.keys.map((key) => [key.id, key.source]));
}

function writeCatalogue(base) {
	for (const scope of snapshot.scopes) {
		const dir = scopeDir(base, scope);

		mkdirSync(dir, { recursive: true });
		writeFileSync(path.join(dir, 'keys.ts'), keysFile(scope), 'utf8');
		writeFileSync(path.join(dir, 'params.ts'), paramsFile(scope), 'utf8');
		writeFileSync(
			path.join(dir, `${DEFAULTS.defaultLang}.json`),
			`${JSON.stringify(sourcesOf(scope), null, '\t')}\n`,
			'utf8',
		);
	}
}

const namesOf = (scope) =>
	(scope.keys?.entries ?? []).map((entry) => `${scope.name}.${entry.name}`);

function liveNames() {
	const scopes = readScopes({ i18nDir: LIVE_I18N, langs: [DEFAULTS.defaultLang] });

	return new Set(scopes.flatMap(namesOf));
}

function gone() {
	const live = liveNames();

	return snapshot.scopes.flatMap((scope) =>
		scope.keys.map((key) => `${scope.name}.${key.name}`).filter((name) => !live.has(name)),
	);
}

const fingerprint = (content) => createHash('sha256').update(content).digest('hex').slice(0, 12);

function exportFor(lang, base, scopes, context) {
	return buildExport({
		scopes,
		defaultLang: DEFAULTS.defaultLang,
		lang,
		usages: new Map(),
		root: base,
		context,
		blank: true,
		i18nDir: base,
		states: new Map(scopes.map((scope) => [scope.name, { data: {} }])),
	});
}

const keyCount = (document) =>
	new Set(document.files.flatMap((file) => file.units.map((unit) => unit.id.split('#')[0]))).size;

function build(base) {
	writeCatalogue(base);

	const langs = [DEFAULTS.defaultLang];
	const scopes = readScopes({ i18nDir: base, langs, rootScope: ROOT_SCOPE });
	const context = readContext({ i18nDir: LIVE_I18N });

	for (const lang of snapshot.langs) {
		const document = exportFor(lang, base, scopes, context);
		const units = `${document.total} unidades de ${keyCount(document)} claves`;

		writeFileSync(path.join(DIR, `${lang}.blank.xlf`), document.content, 'utf8');
		console.log(`  ${lang}: ${units} · huella ${fingerprint(document.content)}`);
	}
}

const base = mkdtempSync(path.join(tmpdir(), 'chesspecker-bench-'));

try {
	console.log(`Banco v${snapshot.version}, congelado el ${snapshot.frozen} (${snapshot.commit})`);
	build(base);
} finally {
	rmSync(base, { recursive: true, force: true });
}

const missing = gone();

for (const name of missing) {
	console.log(`  ⚠ ya no está en el catálogo, su nota de contexto puede haberse perdido: ${name}`);
}

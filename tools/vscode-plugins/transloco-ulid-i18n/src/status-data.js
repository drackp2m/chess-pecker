const { readFileSync } = require('node:fs');
const path = require('node:path');

const STATUSES = ['fresh', 'stale', 'unknown', 'missing'];
const SEVERITIES = ['error', 'warning', 'info'];
const SETTLED_TYPES = new Set(['missing-translation', 'empty-translation', 'stale-translation']);

const emptyKeys = () => Object.fromEntries(STATUSES.map((status) => [status, []]));

const percentOf = (part, total) => (0 === total ? 0 : Math.floor((part * 100) / total));

function progressOf(keys) {
	const total = STATUSES.reduce((sum, status) => sum + keys[status].length, 0);

	return { total, fresh: keys.fresh.length, translated: total - keys.missing.length };
}

const pendingOf = (keys) => keys.stale.length + keys.missing.length;

function languagesOf(targets, rows) {
	const byLang = new Map(targets.map((lang) => [lang, { lang, keys: emptyKeys() }]));

	for (const row of rows) {
		byLang.get(row.lang)?.keys[row.status]?.push(row);
	}

	return [...byLang.values()];
}

function scopeOf(scope, { index, freshness, targets }) {
	const state = freshness.readState(index.i18nDir, scope.name);
	const options = { langs: index.langs, defaultLang: index.defaultLang };
	const rows = freshness
		.freshnessOf(scope, state, options)
		.map((row) => ({ ...row, scope: scope.name }));
	const isUlid = index.modules.config.isUlid;

	return {
		name: scope.name,
		keys: scope.keys.entries.filter((entry) => isUlid(entry.ulid)).length,
		rows,
		languages: languagesOf(targets, rows),
		stateError: null === state.error ? null : { file: state.file, message: state.error },
	};
}

function checksOf(items, severityOf) {
	const byType = new Map();

	for (const item of items.filter((entry) => !SETTLED_TYPES.has(entry.type))) {
		if (!byType.has(item.type)) {
			byType.set(item.type, []);
		}

		byType.get(item.type).push(item);
	}

	const rank = (group) => SEVERITIES.indexOf(group.severity);

	return [...byType]
		.map(([type, list]) => ({ type, severity: severityOf(type), items: list }))
		.sort((left, right) => rank(left) - rank(right) || right.items.length - left.items.length);
}

function cliVersionOf(cliDir) {
	try {
		const file = path.join(path.dirname(cliDir), 'package.json');
		const manifest = JSON.parse(readFileSync(file, 'utf8'));

		return 'string' === typeof manifest.version ? manifest.version : null;
	} catch {
		return null;
	}
}

function buildStatus(index, { freshness, items, severityOf }) {
	const targets = index.langs.filter((lang) => lang !== index.defaultLang);
	const scopes = index.rawScopes
		.filter((scope) => scope.keys)
		.map((scope) => scopeOf(scope, { index, freshness, targets }));

	return {
		source: index.defaultLang,
		keys: scopes.reduce((sum, scope) => sum + scope.keys, 0),
		languages: languagesOf(
			targets,
			scopes.flatMap((scope) => scope.rows),
		),
		scopes,
		checks: checksOf(items, severityOf),
		stateErrors: scopes.map((scope) => scope.stateError).filter((error) => null !== error),
		cliVersion: cliVersionOf(index.cliDir),
		configFile: index.configFile,
	};
}

module.exports = { STATUSES, SEVERITIES, buildStatus, pendingOf, percentOf, progressOf };

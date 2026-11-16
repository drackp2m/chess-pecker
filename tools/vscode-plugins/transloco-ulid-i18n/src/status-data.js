const STATUSES = ['fresh', 'stale', 'unknown', 'missing'];
const SEVERITIES = ['error', 'warning', 'info'];

const emptyKeys = () => Object.fromEntries(STATUSES.map((status) => [status, []]));

const percentOf = (part, total) => (0 === total ? 0 : Math.floor((part * 100) / total));

function progressOf(keys) {
	const total = STATUSES.reduce((sum, status) => sum + keys[status].length, 0);

	return { total, fresh: keys.fresh.length, translated: total - keys.missing.length };
}

const pendingOf = (keys) => keys.stale.length + keys.missing.length;

const mergedKeys = (languages) =>
	Object.fromEntries(
		STATUSES.map((status) => [status, languages.flatMap((language) => language.keys[status])]),
	);

function languagesOf(targets, rows) {
	const byLang = new Map(targets.map((lang) => [lang, { lang, keys: emptyKeys() }]));

	for (const row of rows) {
		byLang.get(row.lang)?.keys[row.status]?.push(row);
	}

	return [...byLang.values()];
}

function scopeOf(scope, { index, targets }) {
	const rows = index.analysis.freshness.filter((row) => row.scope === scope.name);
	const entries = scope.keys.entries
		.filter((entry) => index.api.isUlid(entry.ulid))
		.map(({ name, ulid }) => ({ scope: scope.name, name, ulid }));

	return {
		name: scope.name,
		keys: entries.length,
		entries,
		rows,
		languages: languagesOf(targets, rows),
	};
}

const ruleOf = ({ severity, meaning }) => ({ severity, meaning });

function checksOf(items) {
	const byType = new Map();

	for (const item of items.filter((entry) => 'pending' !== entry.group)) {
		byType.set(item.type, [...(byType.get(item.type) ?? []), item]);
	}

	const rank = (group) => SEVERITIES.indexOf(group.severity);

	return [...byType]
		.map(([type, items]) => ({ type, ...ruleOf(items[0]), items }))
		.sort((left, right) => rank(left) - rank(right) || right.items.length - left.items.length);
}

function buildStatus(index) {
	const targets = index.langs.filter((lang) => lang !== index.defaultLang);
	const scopes = index.rawScopes
		.filter((scope) => scope.keys)
		.map((scope) => scopeOf(scope, { index, targets }));

	return {
		source: index.defaultLang,
		keys: scopes.reduce((sum, scope) => sum + scope.keys, 0),
		languages: languagesOf(targets, index.analysis.freshness),
		scopes,
		checks: checksOf(index.analysis.findings),
		cliVersion: index.api.CLI_VERSION,
		configFile: index.configFile,
	};
}

module.exports = {
	STATUSES,
	SEVERITIES,
	buildStatus,
	mergedKeys,
	pendingOf,
	percentOf,
	progressOf,
};

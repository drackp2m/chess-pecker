const vscode = require('vscode');

const { folded, matchOf, recordsOf } = require('./search');
const { STATUSES, pendingOf } = require('./status-data');
const { count } = require('./util');

const DEBOUNCE = 150;

const keyOf = (scope, ulid) => `${scope}.${ulid}`;

function matchesOf(index, query) {
	const matching = recordsOf(index).filter(
		(record) => index.api.isUlid(record.ulid) && null !== matchOf(record, query),
	);
	const counts = new Map();

	for (const { scope } of matching) {
		counts.set(scope, (counts.get(scope) ?? 0) + 1);
	}

	return { wanted: new Set(matching.map(({ scope, ulid }) => keyOf(scope, ulid))), counts };
}

function keepKeys(keys, wanted) {
	const kept = (rows) => rows.filter((row) => wanted.has(keyOf(row.scope, row.ulid)));

	return Object.fromEntries(STATUSES.map((status) => [status, kept(keys[status])]));
}

function keepLanguages(languages, wanted) {
	return languages
		.map((language) => ({
			...language,
			pending: pendingOf(language.keys),
			keys: keepKeys(language.keys, wanted),
		}))
		.filter((language) => STATUSES.some((status) => 0 !== language.keys[status].length));
}

function keepScopes(scopes, { wanted, counts }) {
	return scopes
		.map((scope) => ({
			...scope,
			keys: counts.get(scope.name) ?? 0,
			entries: scope.entries.filter((entry) => wanted.has(keyOf(entry.scope, entry.ulid))),
			rows: scope.rows.filter((row) => wanted.has(keyOf(row.scope, row.ulid))),
			languages: keepLanguages(scope.languages, wanted),
		}))
		.filter((scope) => 0 !== scope.keys);
}

function keepChecks(checks, { wanted, query }) {
	const kept = (finding) =>
		wanted.has(keyOf(finding.scope, finding.ulid)) || folded(finding.message).includes(query);

	return checks
		.map((group) => ({ ...group, items: group.items.filter(kept) }))
		.filter((group) => 0 !== group.items.length);
}

function filterStatus(snapshot, index, value) {
	const query = folded(value).trim();
	const matches = matchesOf(index, query);
	const scopes = keepScopes(snapshot.scopes, matches);
	const checks = keepChecks(snapshot.checks, { ...matches, query });
	const keys = scopes.reduce((sum, scope) => sum + scope.keys, 0);
	const findings = checks.reduce((sum, group) => sum + group.items.length, 0);

	return {
		...snapshot,
		keys,
		languages: keepLanguages(snapshot.languages, matches.wanted),
		scopes,
		checks,
		filter: { value, keys, findings },
	};
}

function summaryOf(filter) {
	if (undefined === filter) {
		return undefined;
	}

	const parts = [count(filter.keys, 'key'), count(filter.findings, 'finding')];

	return 0 === filter.keys + filter.findings
		? 'nothing matches'
		: parts.filter((part) => !part.startsWith('0 ')).join(' · ');
}

function messageOf(filter) {
	return undefined === filter ? undefined : `“${filter.value}” · ${summaryOf(filter)}`;
}

function askFilter(status) {
	const box = vscode.window.createInputBox();
	let timer;

	box.title = 'Filter keys and checks';
	box.placeholder = 'Key name, ULID, text in any language or check message';
	box.value = status.filter;
	box.valueSelection = [0, status.filter.length];
	box.prompt = summaryOf(status.current().filter);
	box.onDidChangeValue((value) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			box.prompt = summaryOf(status.setFilter(value));
		}, DEBOUNCE);
	});
	box.onDidAccept(() => box.hide());

	return new Promise((resolve) => {
		box.onDidHide(() => {
			clearTimeout(timer);
			status.setFilter(box.value);
			box.dispose();
			resolve();
		});
		box.show();
	});
}

module.exports = { askFilter, filterStatus, messageOf };

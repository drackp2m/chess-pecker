const vscode = require('vscode');

const { STATUSES, buildStatus } = require('./status-data');
const items = require('./status-items');
const { locate } = require('./util');

const VIEW = 'translocoUlidI18n.status';
const SECTIONS = ['languages', 'scopes', 'checks', 'about'];

const CHILDREN = {
	languages: ({ snapshot }) =>
		snapshot.languages.map((language) => ({ kind: 'language', language, scope: null })),
	scopes: ({ snapshot }) => snapshot.scopes.map((scope) => ({ kind: 'scope', scope })),
	scope: ({ scope }) =>
		scope.languages.map((language) => ({ kind: 'language', language, scope: scope.name })),
	language: ({ language, scope }) =>
		STATUSES.filter((status) => 0 !== language.keys[status].length).map((status) => ({
			kind: 'status',
			status,
			language,
			scope,
		})),
	status: ({ status, language }) => language.keys[status].map((row) => ({ kind: 'key', row })),
	checks: ({ snapshot }) => snapshot.checks.map((group) => ({ kind: 'check', group })),
	check: ({ group }) => group.items.map((finding) => ({ kind: 'finding', finding })),
};

function rootNodes(snapshot) {
	if (undefined !== snapshot.error) {
		return [{ kind: 'error', message: snapshot.error }];
	}

	return SECTIONS.map((kind) => ({ kind, snapshot }));
}

class StatusView {
	constructor(index) {
		this.index = index;
		this.snapshot = null;
		this.changed = new vscode.EventEmitter();
		this.onDidChangeTreeData = this.changed.event;
	}

	dispose() {
		this.changed.dispose();
	}

	refresh() {
		this.snapshot = null;
		this.changed.fire(undefined);
	}

	current() {
		this.snapshot = this.snapshot ?? this.build();

		return this.snapshot;
	}

	build() {
		if (null !== this.index.error || null === this.index.api) {
			return { error: this.index.error ?? 'The translation index is not loaded yet' };
		}

		try {
			return buildStatus(this.index);
		} catch (error) {
			return { error: error instanceof Error ? error.message : String(error) };
		}
	}

	getChildren(node) {
		return undefined === node ? rootNodes(this.current()) : (CHILDREN[node.kind]?.(node) ?? []);
	}

	getTreeItem(node) {
		return items[node.kind](node, this.index);
	}
}

async function openKey(index, row) {
	const target = index.translation(row.scope, row.ulid, row.lang);
	const source = index.translation(row.scope, row.ulid, index.defaultLang);
	const location = locate(null === target.text ? source.file : target.file, `"${row.ulid}"`);

	if (null !== location) {
		await vscode.window.showTextDocument(location.uri, { selection: location.range });
	}
}

module.exports = { STATUS_VIEW: VIEW, StatusView, openKey };

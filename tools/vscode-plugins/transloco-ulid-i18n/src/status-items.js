const path = require('node:path');

const vscode = require('vscode');

const { SEVERITIES, STATUSES, pendingOf, percentOf, progressOf } = require('./status-data');
const { ringIcon } = require('./status-icon');
const { shorten } = require('./util');

const SOURCE_PREVIEW = 50;
const MESSAGE_PREVIEW = 80;
const { Collapsed, Expanded, None } = vscode.TreeItemCollapsibleState;

const themed = (icon, color) =>
	new vscode.ThemeIcon(icon, undefined === color ? undefined : new vscode.ThemeColor(color));

const STATUS_LOOK = {
	fresh: { label: 'Up to date', icon: themed('pass', 'testing.iconPassed') },
	stale: { label: 'Outdated', icon: themed('warning', 'problemsWarningIcon.foreground') },
	unknown: { label: 'Never sealed', icon: themed('question') },
	missing: {
		label: 'Untranslated',
		icon: themed('circle-large-outline', 'problemsErrorIcon.foreground'),
	},
};

const SEVERITY_LOOK = {
	error: { word: 'error', icon: themed('error', 'problemsErrorIcon.foreground') },
	warning: { word: 'warning', icon: themed('warning', 'problemsWarningIcon.foreground') },
	info: { word: 'note', icon: themed('info', 'problemsInfoIcon.foreground') },
};

const count = (value, word) => `${value} ${word}${1 === value ? '' : 's'}`;

function openCommand(file, line, col) {
	const position = new vscode.Position(Math.max((line ?? 1) - 1, 0), Math.max((col ?? 1) - 1, 0));
	const selection = new vscode.Range(position, position);

	return {
		command: 'vscode.open',
		title: 'Open',
		arguments: [vscode.Uri.file(file), { selection }],
	};
}

function describe({ total, fresh, translated }) {
	if (0 === total) {
		return 'no keys';
	}

	if (0 === translated) {
		return 'nothing translated';
	}

	const upToDate = `${percentOf(fresh, total)} % up to date`;

	return fresh === translated
		? upToDate
		: `${upToDate} · ${percentOf(translated, total)} % translated`;
}

function languageTooltip(language, scope, progress) {
	const where = null === scope ? '' : ` · ${scope}`;
	const lines = STATUSES.filter((status) => 0 !== language.keys[status].length).map((status) => {
		const { label, icon } = STATUS_LOOK[status];

		return `$(${icon.id}) ${language.keys[status].length} ${label.toLowerCase()}`;
	});
	const header = `**${language.lang}**${where} · ${count(progress.total, 'key')}`;

	return new vscode.MarkdownString(`${header}\n\n${lines.join('  \n')}`, true);
}

function languageItem({ language, scope }) {
	const progress = progressOf(language.keys);
	const item = new vscode.TreeItem(language.lang, Collapsed);

	item.description = describe(progress);
	item.iconPath = ringIcon(progress);
	item.tooltip = languageTooltip(language, scope, progress);
	item.contextValue = 0 === pendingOf(language.keys) ? 'language' : 'languagePending';

	return item;
}

function statusItem({ status, language }) {
	const item = new vscode.TreeItem(STATUS_LOOK[status].label, Collapsed);

	item.description = String(language.keys[status].length);
	item.iconPath = STATUS_LOOK[status].icon;

	return item;
}

function keyTooltip(index, row) {
	const tooltip = new vscode.MarkdownString(`\`${row.scope}.${row.name}\``);

	for (const lang of [index.defaultLang, row.lang]) {
		const text = String(index.translation(row.scope, row.ulid, lang).text ?? '').trim();

		tooltip.appendMarkdown(`\n\n**${lang}** `);
		tooltip.appendText('' === text ? '(empty)' : text);
	}

	return tooltip;
}

function keyItem({ row }, index) {
	const item = new vscode.TreeItem(row.name, None);
	const { text } = index.translation(row.scope, row.ulid, index.defaultLang);

	item.description = `${row.scope} · ${shorten(text ?? '', SOURCE_PREVIEW)}`;
	item.tooltip = keyTooltip(index, row);
	item.command = { command: 'translocoUlidI18n.openKey', title: 'Open', arguments: [row] };

	return item;
}

function scopeItem({ scope }) {
	const item = new vscode.TreeItem(scope.name, Collapsed);

	item.description = count(scope.keys, 'key');
	item.iconPath = themed('symbol-namespace');

	return item;
}

function languagesItem({ snapshot }) {
	const item = new vscode.TreeItem('Languages', Expanded);
	const scopes = count(snapshot.scopes.length, 'scope');

	item.description = `${snapshot.source} · ${count(snapshot.keys, 'key')} · ${scopes}`;
	item.tooltip = `Every target language against ${snapshot.source}, the source language`;
	item.iconPath = themed('globe');

	return item;
}

function scopesItem() {
	const item = new vscode.TreeItem('Scopes', Collapsed);

	item.iconPath = themed('list-tree');

	return item;
}

function checksSummary(checks) {
	const totals = SEVERITIES.map((severity) => {
		const groups = checks.filter((group) => severity === group.severity);

		return [severity, groups.reduce((sum, group) => sum + group.items.length, 0)];
	}).filter(([, total]) => 0 !== total);

	return 0 === totals.length
		? 'all clear'
		: totals.map(([severity, total]) => count(total, SEVERITY_LOOK[severity].word)).join(' · ');
}

function checksItem({ snapshot }) {
	const { checks } = snapshot;
	const item = new vscode.TreeItem('Checks', 0 === checks.length ? None : Collapsed);

	item.description = checksSummary(checks);
	item.tooltip = 'What transloco-ulid check reports, besides the pending translations above';
	item.iconPath =
		0 === checks.length ? STATUS_LOOK.fresh.icon : SEVERITY_LOOK[checks[0].severity].icon;

	return item;
}

function checkItem({ group }) {
	const item = new vscode.TreeItem(group.type, Collapsed);

	item.description = String(group.items.length);
	item.iconPath = SEVERITY_LOOK[group.severity].icon;

	return item;
}

function findingItem({ finding }, index) {
	const item = new vscode.TreeItem(shorten(finding.message, MESSAGE_PREVIEW), None);
	const file = path.resolve(index.root, finding.file);
	const where = path.relative(index.root, file);

	item.description = Number.isInteger(finding.line) ? `${where}:${finding.line}` : where;
	item.tooltip =
		'string' === typeof finding.lang ? `${finding.message} [${finding.lang}]` : finding.message;
	item.command = openCommand(file, finding.line, finding.col);

	return item;
}

function aboutItem({ snapshot }, index) {
	const version = null === snapshot.cliVersion ? '' : ` ${snapshot.cliVersion}`;
	const item = new vscode.TreeItem(`CLI${version}`, None);

	item.description = path.relative(index.root, snapshot.configFile);
	item.tooltip = `@drackp2m/transloco-ulid-cli in ${index.cliDir}`;
	item.iconPath = themed('package');
	item.command = openCommand(snapshot.configFile);

	return item;
}

function errorItem({ message, file }) {
	const item = new vscode.TreeItem(message, None);

	item.tooltip = message;
	item.iconPath = SEVERITY_LOOK.error.icon;
	item.command =
		undefined === file
			? { command: 'translocoUlidI18n.reload', title: 'Reload' }
			: openCommand(file);

	return item;
}

module.exports = {
	about: aboutItem,
	check: checkItem,
	checks: checksItem,
	error: errorItem,
	finding: findingItem,
	key: keyItem,
	language: languageItem,
	languages: languagesItem,
	scope: scopeItem,
	scopes: scopesItem,
	status: statusItem,
};

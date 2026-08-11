const vscode = require('vscode');

const { Annotations } = require('./annotations');
const { createKey } = require('./create-key');
const { Findings } = require('./findings');
const { i18nDefinitionProvider, i18nReferenceProvider } = require('./navigation');
const { completionProvider, definitionProvider, hoverProvider } = require('./providers');
const { ensureTemplateSetup } = require('./setup');
const { UsageIndex } = require('./usages');

const { I18nIndex } = require('./index');

const DEBOUNCE = 250;

const langsSetting = () => vscode.workspace.getConfiguration('translocoUlidI18n').get('langs', []);

async function reload(state, notify) {
	const error = await state.index.reload(langsSetting());

	if (null !== error && true === notify) {
		vscode.window.showErrorMessage(`Transloco ULID i18n: ${error}`);
	}

	state.annotations.refreshAll();
	state.findings.schedule();

	return error;
}

function watchTranslations(state) {
	const pattern = new vscode.RelativePattern(state.index.i18nDir, '**/*.{ts,json}');
	const watcher = vscode.workspace.createFileSystemWatcher(pattern);
	const onChange = () => void reload(state, false);

	watcher.onDidChange(onChange);
	watcher.onDidCreate(onChange);
	watcher.onDidDelete(onChange);

	return watcher;
}

function watchSources({ usages, findings }) {
	const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,html}');
	const invalidate = () => usages.invalidate();
	const onChange = () => {
		usages.invalidate();
		findings.schedule();
	};

	watcher.onDidChange(onChange);
	watcher.onDidCreate(onChange);
	watcher.onDidDelete(onChange);

	return [watcher, vscode.workspace.onDidChangeTextDocument(invalidate)];
}

function watchEditors(annotations) {
	let timer = null;

	const schedule = (document) => {
		if (null !== timer) {
			clearTimeout(timer);
		}

		timer = setTimeout(() => annotations.refresh(document), DEBOUNCE);
	};

	return [
		vscode.window.onDidChangeActiveTextEditor((editor) => annotations.refresh(editor?.document)),
		vscode.window.onDidChangeTextEditorSelection((event) => annotations.repaint(event.textEditor)),
		vscode.workspace.onDidChangeTextDocument((event) => schedule(event.document)),
		vscode.workspace.onDidOpenTextDocument((document) => annotations.refresh(document)),
		vscode.workspace.onDidCloseTextDocument((document) => annotations.clear(document)),
	];
}

function registerCommands(state) {
	const { index, annotations } = state;
	const run = (task) => () => {
		task().catch((error) =>
			vscode.window.showErrorMessage(`Transloco ULID i18n: ${error.message}`),
		);
	};

	return [
		vscode.commands.registerCommand(
			'translocoUlidI18n.createKey',
			run(() => createKey(index, annotations)),
		),
		vscode.commands.registerCommand(
			'translocoUlidI18n.reload',
			run(() => reload(state, true)),
		),
		vscode.commands.registerCommand(
			'translocoUlidI18n.toggleInlineText',
			run(() => toggleInlineText(annotations)),
		),
		vscode.commands.registerCommand('translocoUlidI18n.ensureTemplateSetup', (uri) =>
			run(() => ensureTemplateSetup(uri))(),
		),
	];
}

async function toggleInlineText(annotations) {
	const settings = vscode.workspace.getConfiguration('translocoUlidI18n');

	await settings.update('inlineText', true !== settings.get('inlineText', true), true);

	annotations.refreshAll();
}

function subscriptionsOf(state) {
	const { index, annotations, usages, findings } = state;

	return [
		annotations,
		findings,
		hoverProvider(index),
		definitionProvider(index),
		completionProvider(index),
		i18nDefinitionProvider(index, usages),
		i18nReferenceProvider(index, usages),
		watchTranslations(state),
		...watchSources(state),
		...watchEditors(annotations),
		...registerCommands(state),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('translocoUlidI18n')) {
				void reload(state, false);
			}
		}),
	];
}

async function activate(context) {
	const [folder] = vscode.workspace.workspaceFolders ?? [];

	if (undefined === folder) {
		return;
	}

	const index = new I18nIndex(folder.uri.fsPath);
	const state = {
		index,
		annotations: new Annotations(index),
		usages: new UsageIndex(index),
		findings: new Findings(index),
	};

	await reload(state, false);

	context.subscriptions.push(...subscriptionsOf(state));
}

module.exports = { activate, deactivate: () => undefined };

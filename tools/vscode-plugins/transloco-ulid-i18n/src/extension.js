const vscode = require('vscode');

const { Annotations } = require('./annotations');
const { createKey } = require('./create-key');
const { completionProvider, definitionProvider, hoverProvider } = require('./providers');

const { I18nIndex } = require('./index');

const DEBOUNCE = 250;

const langsSetting = () => vscode.workspace.getConfiguration('translocoUlidI18n').get('langs', []);

async function reload(index, annotations, notify) {
	const error = await index.reload(langsSetting());

	if (null !== error && true === notify) {
		vscode.window.showErrorMessage(`Transloco ULID i18n: ${error}`);
	}

	annotations.refreshAll();

	return error;
}

function watchTranslations(index, annotations) {
	const pattern = new vscode.RelativePattern(index.i18nDir, '**/*.{ts,json}');
	const watcher = vscode.workspace.createFileSystemWatcher(pattern);
	const onChange = () => void reload(index, annotations, false);

	watcher.onDidChange(onChange);
	watcher.onDidCreate(onChange);
	watcher.onDidDelete(onChange);

	return watcher;
}

function watchEditors(index, annotations) {
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

function registerCommands(index, annotations) {
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
			run(() => reload(index, annotations, true)),
		),
		vscode.commands.registerCommand(
			'translocoUlidI18n.toggleInlineText',
			run(() => toggleInlineText(annotations)),
		),
	];
}

async function toggleInlineText(annotations) {
	const settings = vscode.workspace.getConfiguration('translocoUlidI18n');

	await settings.update('inlineText', true !== settings.get('inlineText', true), true);

	annotations.refreshAll();
}

async function activate(context) {
	const [folder] = vscode.workspace.workspaceFolders ?? [];

	if (undefined === folder) {
		return;
	}

	const index = new I18nIndex(folder.uri.fsPath);
	const annotations = new Annotations(index);

	await reload(index, annotations, false);

	context.subscriptions.push(
		annotations,
		hoverProvider(index),
		definitionProvider(index),
		completionProvider(index),
		watchTranslations(index, annotations),
		...watchEditors(index, annotations),
		...registerCommands(index, annotations),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('translocoUlidI18n')) {
				void reload(index, annotations, false);
			}
		}),
	);
}

module.exports = { activate, deactivate: () => undefined };

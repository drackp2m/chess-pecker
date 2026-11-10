const vscode = require('vscode');

const { importEdit } = require('./imports');

const INTERPOLATION = '{{ I18n.$0 | i18n }}';
const EXPRESSION = 'I18n.$0';

function inTag(prefix) {
	const open = prefix.lastIndexOf('<');

	return -1 !== open && open > prefix.lastIndexOf('>');
}

function inInterpolation(prefix) {
	const open = prefix.lastIndexOf('{{');

	return -1 !== open && open > prefix.lastIndexOf('}}');
}

function htmlSnippet(document, prefix) {
	if (inTag(prefix)) {
		return null;
	}

	const item = new vscode.CompletionItem(
		{ label: 'i18n', description: inInterpolation(prefix) ? EXPRESSION : INTERPOLATION },
		vscode.CompletionItemKind.Snippet,
	);

	item.insertText = new vscode.SnippetString(inInterpolation(prefix) ? EXPRESSION : INTERPOLATION);
	item.detail = 'transloco key + component wiring';
	item.command = {
		command: 'translocoUlidI18n.ensureTemplateSetup',
		title: 'Wire the component up',
		arguments: [document.uri],
	};

	return item;
}

function typescriptSnippet(document, aliases) {
	const item = new vscode.CompletionItem(
		{ label: 'i18n', description: EXPRESSION },
		vscode.CompletionItemKind.Snippet,
	);

	item.insertText = new vscode.SnippetString(EXPRESSION);
	item.detail = 'transloco key + import';
	item.additionalTextEdits = [
		importEdit(document, aliases.i18n, `import { I18n } from '${aliases.i18n}';`, aliases.app),
	].filter((edit) => null !== edit);

	return item;
}

function snippetItems(document, prefix, aliases) {
	const item =
		'html' === document.languageId
			? htmlSnippet(document, prefix)
			: typescriptSnippet(document, aliases);

	if (null === item) {
		return [];
	}

	item.filterText = 'i18n';
	item.sortText = '0000';

	return [item];
}

module.exports = { snippetItems };

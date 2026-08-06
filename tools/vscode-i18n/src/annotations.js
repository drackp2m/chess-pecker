const vscode = require('vscode');

const { displayRange, shorten, usageRange } = require('./util');

const SUPPORTED = new Set(['typescript', 'html']);

const hiddenType = vscode.window.createTextEditorDecorationType({
	textDecoration: 'none; display: none;',
});

const inlineType = vscode.window.createTextEditorDecorationType({
	before: {
		color: new vscode.ThemeColor('editorCodeLens.foreground'),
	},
});

const settings = () => vscode.workspace.getConfiguration('chesspeckerI18n');

function inlineLabel(index, usage) {
	const entry = index.entry(usage.scope, usage.key);

	if (null === entry) {
		return null;
	}

	const { text, missing } = index.translation(usage.scope, entry.ulid, index.defaultLang);

	return missing ? '⚠️ missing' : shorten(text, settings().get('inlineTextMaxLength', 60));
}

function revealed(range, selections) {
	return selections.some((selection) => undefined !== range.intersection(selection));
}

function decorationsFor(index, editor, usages) {
	const hidden = [];
	const inline = [];

	if (true !== settings().get('inlineText', true)) {
		return { hidden, inline };
	}

	for (const usage of usages) {
		const label = inlineLabel(index, usage);
		const range = displayRange(editor.document, usage);

		if (null === label || revealed(range, editor.selections)) {
			continue;
		}

		hidden.push(range);
		inline.push({
			range: new vscode.Range(range.start, range.start),
			renderOptions: { before: { contentText: label } },
		});
	}

	return { hidden, inline };
}

function diagnosticFor(index, document, usage) {
	const range = usageRange(document, usage);
	const entry = index.entry(usage.scope, usage.key);

	if (null === entry) {
		const scope = index.scopes.get(usage.scope);
		const where = undefined === scope ? `scope "${usage.scope}"` : scope.keysFile;
		const message = `"${usage.key}" is not declared in ${where}`;

		return new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
	}

	const missing = index.langs.filter(
		(lang) => index.translation(usage.scope, entry.ulid, lang).missing,
	);

	if (!missing.length) {
		return null;
	}

	const message = `No ${missing.join(', ')} translation for ${usage.scope}.${usage.key}`;
	const severity =
		missing.includes(index.defaultLang) || missing.length === index.langs.length
			? vscode.DiagnosticSeverity.Error
			: vscode.DiagnosticSeverity.Warning;

	return new vscode.Diagnostic(range, message, severity);
}

class Annotations {
	constructor(index) {
		this.index = index;
		this.diagnostics = vscode.languages.createDiagnosticCollection('chesspecker-i18n');
	}

	clear(document) {
		this.diagnostics.delete(document.uri);
	}

	dispose() {
		this.diagnostics.dispose();
	}

	refresh(document) {
		if (undefined === document || !SUPPORTED.has(document.languageId)) {
			return;
		}

		const usages = this.index.findUsages(document.getText());
		const diagnostics = usages
			.map((usage) => diagnosticFor(this.index, document, usage))
			.filter((diagnostic) => null !== diagnostic);

		this.diagnostics.set(document.uri, diagnostics);

		for (const editor of vscode.window.visibleTextEditors) {
			if (editor.document === document) {
				this.paint(editor, usages);
			}
		}
	}

	paint(editor, usages) {
		const { hidden, inline } = decorationsFor(this.index, editor, usages);

		editor.setDecorations(hiddenType, hidden);
		editor.setDecorations(inlineType, inline);
	}

	repaint(editor) {
		if (undefined === editor || !SUPPORTED.has(editor.document.languageId)) {
			return;
		}

		this.paint(editor, this.index.findUsages(editor.document.getText()));
	}

	refreshAll() {
		for (const editor of vscode.window.visibleTextEditors) {
			this.refresh(editor.document);
		}
	}
}

module.exports = { Annotations };

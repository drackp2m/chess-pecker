const vscode = require('vscode');

const { shorten, usageDisplay, usageRange } = require('./util');

const SUPPORTED = new Set(['typescript', 'html']);

const hiddenType = vscode.window.createTextEditorDecorationType({
	textDecoration: 'none; display: none;',
});

const inlineType = vscode.window.createTextEditorDecorationType({
	before: {
		color: new vscode.ThemeColor('editorCodeLens.foreground'),
	},
});

const ghostType = vscode.window.createTextEditorDecorationType({
	after: {
		color: new vscode.ThemeColor('editorCodeLens.foreground'),
	},
});

const bareType = vscode.window.createTextEditorDecorationType({
	after: {
		color: new vscode.ThemeColor('editorWarning.foreground'),
	},
});

const settings = () => vscode.workspace.getConfiguration('translocoUlidI18n');

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

function collapseInto(groups, range, label) {
	groups.hidden.push(range);
	groups.inline.push({
		range: new vscode.Range(range.start, range.start),
		renderOptions: { before: { contentText: label } },
	});
}

function appendInto(groups, mode, range, label) {
	const target = 'bare' === mode ? groups.bare : groups.ghost;

	target.push({
		range: new vscode.Range(range.end, range.end),
		renderOptions: { after: { contentText: ` «${label}»` } },
	});
}

function decorationsFor(index, editor, usages) {
	const groups = { hidden: [], inline: [], ghost: [], bare: [] };

	if (true !== settings().get('inlineText', true)) {
		return groups;
	}

	for (const usage of usages) {
		const label = inlineLabel(index, usage);
		const { range, mode } = usageDisplay(editor.document, usage);

		if (null === label) {
			continue;
		}

		if ('collapse' !== mode) {
			appendInto(groups, mode, range, label);
		} else if (!revealed(range, editor.selections)) {
			collapseInto(groups, range, label);
		}
	}

	return groups;
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

function pipeDiagnostic(document, usage) {
	if ('bare' !== usageDisplay(document, usage).mode) {
		return null;
	}

	const detail = 'is interpolated without "| i18n", so the key itself is what renders';
	const message = `${usage.scope}.${usage.key} ${detail}`;
	const diagnostic = new vscode.Diagnostic(
		usageRange(document, usage),
		message,
		vscode.DiagnosticSeverity.Warning,
	);

	diagnostic.code = 'missing-pipe';

	return diagnostic;
}

class Annotations {
	constructor(index) {
		this.index = index;
		this.diagnostics = vscode.languages.createDiagnosticCollection('transloco-ulid-i18n');
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
			.flatMap((usage) => [
				diagnosticFor(this.index, document, usage),
				pipeDiagnostic(document, usage),
			])
			.filter((diagnostic) => null !== diagnostic);

		this.diagnostics.set(document.uri, diagnostics);

		for (const editor of vscode.window.visibleTextEditors) {
			if (editor.document === document) {
				this.paint(editor, usages);
			}
		}
	}

	paint(editor, usages) {
		const groups = decorationsFor(this.index, editor, usages);

		editor.setDecorations(hiddenType, groups.hidden);
		editor.setDecorations(inlineType, groups.inline);
		editor.setDecorations(ghostType, groups.ghost);
		editor.setDecorations(bareType, groups.bare);
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

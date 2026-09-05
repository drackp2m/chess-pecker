const vscode = require('vscode');

const { inlineText, inlineTextMaxLength } = require('./settings');
const { shorten, usageDisplay, usageRange } = require('./util');

const SUPPORTED = new Set(['typescript', 'html']);
const MISSING = '⚠️ missing translation';
const INVALID = '⚠️ invalid ICU';

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

function inlineLabel(index, usage) {
	const entry = index.entry(usage.scope, usage.key);

	if (null === entry) {
		return null;
	}

	const { text, missing } = index.translation(usage.scope, entry.ulid, index.displayLang);

	if (missing) {
		return MISSING;
	}

	try {
		const representative = representativeText(index, text);
		const max = Math.max(inlineTextMaxLength() - 2, 1);

		return representative === text
			? shorten(text, inlineTextMaxLength())
			: `${shorten(representative, max)} *`;
	} catch {
		return INVALID;
	}
}

function representativeText(index, text) {
	const { leavesOf, paramsOf } = index.modules.message;
	const dimensions = [...paramsOf(text)].filter(([, param]) => 'plain' !== param.type);

	if (0 === dimensions.length) {
		return text;
	}

	const preferred = dimensions.map(([name, param]) => {
		const key =
			'select' === param.type && 'gender' === name && param.cases.includes('male')
				? 'male'
				: 'other';

		return `${param.type}:${key}`;
	});
	const leaf = leavesOf(text).find(({ path: value }) =>
		value.every((segment, order) => segment === preferred[order]),
	);

	return leaf?.text ?? text;
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

function appendInto(groups, range, label) {
	groups.ghost.push({
		range: new vscode.Range(range.end, range.end),
		renderOptions: { after: { contentText: ` «${label}»` } },
	});
}

function decorationsFor(index, editor, usages) {
	const groups = { hidden: [], inline: [], ghost: [] };

	if (!inlineText()) {
		return groups;
	}

	for (const usage of usages) {
		const label = inlineLabel(index, usage);
		const { range, mode } = usageDisplay(editor.document, usage);

		if (null === label || 'bare' === mode) {
			continue;
		}

		if ('ghost' === mode) {
			appendInto(groups, range, label);
		} else if (!revealed(range, editor.selections)) {
			collapseInto(groups, range, label);
		}
	}

	return groups;
}

function unknownKeyDiagnostic(index, document, usage) {
	const scope = index.scopes.get(usage.scope);
	const where = undefined === scope ? `scope "${usage.scope}"` : scope.keysFile;
	const message = `"${usage.key}" is not declared in ${where}`;
	const diagnostic = new vscode.Diagnostic(
		usageRange(document, usage),
		message,
		vscode.DiagnosticSeverity.Error,
	);

	diagnostic.code = 'unknown-key';

	return diagnostic;
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
		vscode.DiagnosticSeverity.Error,
	);

	diagnostic.code = 'missing-pipe';

	return diagnostic;
}

function missingDiagnostic(index, document, usage) {
	const entry = index.entry(usage.scope, usage.key);
	const missing = index.langs.filter(
		(lang) => index.translation(usage.scope, entry.ulid, lang).missing,
	);

	if (!missing.length) {
		return null;
	}

	const message = `No ${missing.join(', ')} translation for ${usage.scope}.${usage.key}`;
	const diagnostic = new vscode.Diagnostic(
		usageRange(document, usage),
		message,
		vscode.DiagnosticSeverity.Warning,
	);

	diagnostic.code = 'missing-translation';

	return diagnostic;
}

function icuDiagnostic(index, document, usage) {
	const entry = index.entry(usage.scope, usage.key);
	const problems = index.icuProblems(usage.scope, entry.ulid);

	if (0 === problems.length) {
		return null;
	}

	const message = problems.map(({ lang, message: detail }) => `${lang}: ${detail}`).join('; ');
	const diagnostic = new vscode.Diagnostic(
		usageRange(document, usage),
		message,
		vscode.DiagnosticSeverity.Error,
	);

	diagnostic.code = 'icu-message';

	return diagnostic;
}

function diagnosticFor(index, document, usage) {
	if (null === index.entry(usage.scope, usage.key)) {
		return unknownKeyDiagnostic(index, document, usage);
	}

	return (
		pipeDiagnostic(document, usage) ??
		icuDiagnostic(index, document, usage) ??
		missingDiagnostic(index, document, usage)
	);
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
		const groups = decorationsFor(this.index, editor, usages);

		editor.setDecorations(hiddenType, groups.hidden);
		editor.setDecorations(inlineType, groups.inline);
		editor.setDecorations(ghostType, groups.ghost);
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

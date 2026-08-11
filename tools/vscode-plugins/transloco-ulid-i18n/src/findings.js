const { readFileSync } = require('node:fs');

const vscode = require('vscode');

const DEBOUNCE = 750;

const SEVERITIES = {
	error: vscode.DiagnosticSeverity.Error,
	warning: vscode.DiagnosticSeverity.Warning,
	info: vscode.DiagnosticSeverity.Information,
};

function lengthOf(lines, line) {
	return lines[line]?.replace(/\r$/, '').length ?? 0;
}

function rangeOf(lines, finding) {
	const line = Math.max((finding.line ?? 1) - 1, 0);
	const start = Math.max((finding.col ?? 1) - 1, 0);

	return new vscode.Range(line, start, line, Math.max(lengthOf(lines, line), start + 1));
}

function readLines(cache, file) {
	if (!cache.has(file)) {
		try {
			cache.set(file, readFileSync(file, 'utf8').split('\n'));
		} catch {
			cache.set(file, []);
		}
	}

	return cache.get(file);
}

function toDiagnostic(cache, severityOf, item) {
	const diagnostic = new vscode.Diagnostic(
		rangeOf(readLines(cache, item.file), item),
		null === item.lang ? item.message : `${item.message} [${item.lang}]`,
		SEVERITIES[severityOf(item.type)],
	);

	diagnostic.code = item.type;
	diagnostic.source = 'i18n';

	return diagnostic;
}

function groupByFile(items) {
	const byFile = new Map();

	for (const item of items) {
		byFile.set(item.file, [...(byFile.get(item.file) ?? []), item]);
	}

	return byFile;
}

class Findings {
	constructor(index) {
		this.index = index;
		this.diagnostics = vscode.languages.createDiagnosticCollection('transloco-ulid-i18n-files');
		this.timer = null;
	}

	dispose() {
		if (null !== this.timer) {
			clearTimeout(this.timer);
		}

		this.diagnostics.dispose();
	}

	schedule() {
		if (null !== this.timer) {
			clearTimeout(this.timer);
		}

		this.timer = setTimeout(() => this.refresh(), DEBOUNCE);
	}

	refresh() {
		const { checks, collect, findings } = this.index.modules ?? {};

		if (undefined === checks || 0 === this.index.rawScopes.length) {
			this.diagnostics.clear();

			return;
		}

		try {
			this.publish(this.collectFindings(checks, collect), findings.severityOf);
		} catch {
			this.diagnostics.clear();
		}
	}

	collectFindings(checks, collect) {
		const { usages, commented } = collect.collectUsages(this.index.sourceDirs);

		return checks.buildFindings({
			scopes: this.index.rawScopes,
			usages,
			commented,
			langs: this.index.langs,
			defaultLang: this.index.defaultLang,
			i18nDir: this.index.i18nDir,
		});
	}

	publish(items, severityOf) {
		const cache = new Map();

		this.diagnostics.clear();

		for (const [file, group] of groupByFile(items)) {
			this.diagnostics.set(
				vscode.Uri.file(file),
				group.map((item) => toDiagnostic(cache, severityOf, item)),
			);
		}
	}
}

module.exports = { Findings };

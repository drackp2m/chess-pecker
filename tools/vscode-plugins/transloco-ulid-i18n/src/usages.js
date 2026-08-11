const { existsSync, readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const vscode = require('vscode');

const SOURCE_EXTENSIONS = new Set(['.ts', '.html']);
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'out-tsc', 'coverage', '.angular']);

function* walkSources(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			if (!SKIPPED_DIRS.has(entry.name)) {
				yield* walkSources(full);
			}

			continue;
		}

		if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
			yield full;
		}
	}
}

function unsavedTexts() {
	const texts = new Map();

	for (const document of vscode.workspace.textDocuments) {
		if (document.isDirty && 'file' === document.uri.scheme) {
			texts.set(document.uri.fsPath, document.getText());
		}
	}

	return texts;
}

function positionOf(content, offset) {
	const before = content.slice(0, offset);

	return new vscode.Position(
		before.split('\n').length - 1,
		offset - (before.lastIndexOf('\n') + 1),
	);
}

class UsageIndex {
	constructor(index) {
		this.index = index;
		this.entries = null;
	}

	invalidate() {
		this.entries = null;
	}

	locationsOf(scopeName, keyName) {
		this.entries ??= this.build();

		return this.entries.get(`${scopeName}:${keyName}`) ?? [];
	}

	build() {
		const entries = new Map();
		const unsaved = unsavedTexts();

		for (const dir of this.index.sourceDirs.filter((entry) => existsSync(entry))) {
			for (const file of walkSources(dir)) {
				this.record(entries, file, unsaved.get(file) ?? readFileSync(file, 'utf8'));
			}
		}

		return entries;
	}

	record(entries, file, content) {
		const uri = vscode.Uri.file(file);

		for (const usage of this.index.findUsages(content)) {
			const id = `${usage.scope}:${usage.key}`;
			const range = new vscode.Range(
				positionOf(content, usage.start),
				positionOf(content, usage.end),
			);

			entries.set(id, [...(entries.get(id) ?? []), new vscode.Location(uri, range)]);
		}
	}
}

module.exports = { UsageIndex };

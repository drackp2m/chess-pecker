const { readFileSync } = require('node:fs');
const path = require('node:path');

const vscode = require('vscode');

const CONFIG = 'translocoUlidI18n';
const XLIFF_FILTERS = { XLIFF: ['xlf', 'xliff'] };

let channel = null;

const count = (value, word) => `${value} ${word}${1 === value ? '' : 's'}`;

function transferDir(root) {
	const configured = vscode.workspace.getConfiguration(CONFIG).get('transferDir', 'translations');

	return path.isAbsolute(configured) ? configured : path.join(root, configured);
}

function showProblems(problems) {
	channel = channel ?? vscode.window.createOutputChannel('Transloco ULID i18n');

	channel.clear();

	for (const { file, message } of problems) {
		channel.appendLine(`${file}  ${message}`);
	}

	channel.show(true);
}

async function pickLangs(index) {
	const targets = index.langs.filter((lang) => lang !== index.defaultLang);
	const picked = await vscode.window.showQuickPick(
		targets.map((lang) => ({ label: lang, picked: true })),
		{ title: `Languages to export (source: ${index.defaultLang})`, canPickMany: true },
	);

	return picked?.map(({ label }) => label) ?? null;
}

async function pickScope() {
	const picked = await vscode.window.showQuickPick(
		[
			{ label: 'Every string', missingOnly: false, description: 'the whole catalogue' },
			{ label: 'Only untranslated', missingOnly: true, description: 'what has no target yet' },
		],
		{ title: 'What to export' },
	);

	return picked?.missingOnly ?? null;
}

async function revealed(written, outDir) {
	const message = `i18n: ${count(written.length, 'file')} written to ${outDir}`;
	const action = await vscode.window.showInformationMessage(message, 'Reveal');

	if ('Reveal' === action) {
		await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(written[0]));
	}
}

async function writeExports(index, langs, missingOnly, outDir) {
	const [transfer, collect] = await Promise.all([
		index.load('transfer/build.mjs'),
		index.load('catalogue/collect.mjs'),
	]);
	const { usages } = collect.collectUsages(index.sourceDirs);
	const base = {
		scopes: index.rawScopes,
		defaultLang: index.defaultLang,
		langs: index.langs,
		i18nDir: index.i18nDir,
		root: index.root,
		filter: missingOnly ? 'missing' : 'all',
	};

	return langs
		.map((lang) => transfer.buildExport({ ...base, lang, usages }))
		.filter((document) => 0 !== document.total)
		.map((document) => transfer.writeExport(document, outDir).file);
}

async function exportTranslations(index) {
	const langs = await pickLangs(index);

	if (null === langs || 0 === langs.length) {
		return;
	}

	const missingOnly = await pickScope();

	if (null === missingOnly) {
		return;
	}

	const outDir = transferDir(index.root);
	const written = await writeExports(index, langs, missingOnly, outDir);

	if (0 === written.length) {
		vscode.window.showInformationMessage('i18n: nothing to export');

		return;
	}

	await revealed(written, outDir);
}

// Import writes the JSON and keys.ts files straight to disk, so an unsaved
// editor over any of them would be overwritten the moment it is saved back.
function dirtyIn(dir) {
	return vscode.workspace.textDocuments
		.filter((document) => document.isDirty && document.uri.fsPath.startsWith(dir))
		.map((document) => path.basename(document.uri.fsPath));
}

async function pickNewKeys(added) {
	if (0 === added.length) {
		return [];
	}

	const picked = await vscode.window.showQuickPick(
		added.map((entry) => ({
			label: `${entry.scope}.${entry.name}`,
			description: entry.source,
			entry,
		})),
		{
			title: 'Keys the file has that keys.ts does not — pick the ones to add',
			canPickMany: true,
		},
	);

	return picked?.map(({ entry }) => entry) ?? null;
}

async function readDocuments(index, uris) {
	const xliff = await index.load('transfer/xliff.mjs');

	return uris.map((uri) => ({
		file: uri.fsPath,
		xliff: xliff.readXliff(readFileSync(uri.fsPath, 'utf8')),
	}));
}

function report(plan, written, accepted) {
	const updated = [...plan.counts.values()].reduce((total, item) => total + item.updated, 0);
	const parts = [count(updated, 'string'), `${count(written.length, 'file')} written`];

	if (0 !== accepted.length) {
		parts.push(count(accepted.length, 'new key'));
	}

	vscode.window.showInformationMessage(`i18n: ${parts.join(' · ')}`);

	if (0 !== plan.problems.length) {
		showProblems(plan.problems);
	}
}

async function chooseFiles(index) {
	const uris = await vscode.window.showOpenDialog({
		title: 'XLIFF files to import',
		canSelectMany: true,
		defaultUri: vscode.Uri.file(transferDir(index.root)),
		filters: XLIFF_FILTERS,
	});

	return undefined === uris || 0 === uris.length ? null : uris;
}

async function importTranslations(index, annotations) {
	const dirty = dirtyIn(index.i18nDir);

	if (0 !== dirty.length) {
		throw new Error(`save ${dirty.join(', ')} first — the import writes those files`);
	}

	const uris = await chooseFiles(index);

	if (null === uris) {
		return;
	}

	const merge = await index.load('transfer/merge.mjs');
	const documents = await readDocuments(index, uris);
	const base = {
		scopes: index.rawScopes,
		defaultLang: index.defaultLang,
		langs: index.langs,
		i18nDir: index.i18nDir,
	};
	const plan = merge.planImport({ ...base, documents });
	const accepted = await pickNewKeys(plan.added);

	if (null === accepted) {
		return;
	}

	const written = merge.applyImport({ ...base, plan, accepted });

	await index.reload();
	annotations.refreshAll();
	report(plan, written, accepted);
}

module.exports = { exportTranslations, importTranslations };

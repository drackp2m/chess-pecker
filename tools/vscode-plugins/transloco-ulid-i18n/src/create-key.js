const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');

const vscode = require('vscode');

const { NEW_SCOPE, createScope } = require('./create-scope');
const { ensureTemplateSetup } = require('./setup');

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const KEY_NAME = /^[A-Z][A-Z0-9_]*$/;
const PARAM_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const KEYS_END = '} as const;';

function encodeTime(time) {
	let result = '';

	for (let index = 0; 10 > index; index += 1) {
		result = ALPHABET[time % 32] + result;
		time = Math.floor(time / 32);
	}

	return result;
}

function ulid() {
	const random = [...randomBytes(16)].map((byte) => ALPHABET[byte % 32]).join('');

	return encodeTime(Date.now()) + random;
}

async function pickScope(index, document) {
	const names = index.scopeNames();
	const guess = names.find((name) => document?.uri.fsPath.includes(`${name}.page.`));

	const picked = await vscode.window.showQuickPick([...names, NEW_SCOPE], {
		title: 'i18n scope',
		placeHolder: guess ?? names[0] ?? NEW_SCOPE,
	});

	if (undefined === picked) {
		return null;
	}

	return NEW_SCOPE === picked ? createScope(index) : picked;
}

async function askName(index, scope) {
	return vscode.window.showInputBox({
		title: `New key in ${scope}`,
		placeHolder: 'SECTION_TITLE',
		validateInput: (value) => {
			if (!KEY_NAME.test(value)) {
				return 'Use SCREAMING_SNAKE_CASE';
			}

			return null === index.entry(scope, value) ? null : `${value} already exists`;
		},
	});
}

async function askKind() {
	const picked = await vscode.window.showQuickPick(
		[
			{ label: 'Texto', kind: 'plain' },
			{ label: 'Plural', kind: 'plural' },
		],
		{ title: 'Tipo de clave' },
	);

	return picked?.kind ?? null;
}

async function askPluralArgument(name) {
	const argument = await vscode.window.showInputBox({
		title: `${name} · parámetro plural`,
		value: 'count',
		validateInput: (value) => (PARAM_NAME.test(value) ? null : 'Usa un nombre de parámetro válido'),
	});

	return argument;
}

async function askPluralForms(index, name, seed, categories) {
	const forms = new Map();

	for (const category of categories) {
		const value = await vscode.window.showInputBox({
			title: `${name} · ${index.defaultLang} · ${category}`,
			value: categories[0] === category ? seed : '',
			prompt: 'Obligatorio',
		});

		if (undefined === value || '' === value.trim()) {
			return null;
		}

		forms.set(category, value);
	}

	return forms;
}

async function askPluralTexts(index, name, seed) {
	const argument = await askPluralArgument(name);

	if (undefined === argument) {
		return null;
	}

	const { requiredCategoriesOf } = await index.load('catalogue/plurals.mjs');
	const categories = requiredCategoriesOf(index.defaultLang) ?? ['one', 'other'];
	const forms = await askPluralForms(index, name, seed, categories);

	if (null === forms) {
		return null;
	}

	const texts = new Map(index.langs.map((lang) => [lang, '']));
	const branches = categories.map((category) => `${category} {${forms.get(category)}}`).join(' ');
	const source = `{${argument}, plural, ${branches}}`;

	texts.set(index.defaultLang, source);

	return texts;
}

async function askTexts(index, name, seed) {
	const texts = new Map();

	for (const lang of index.langs) {
		const value = await vscode.window.showInputBox({
			title: `${name} · ${lang}`,
			value: lang === index.defaultLang ? seed : '',
			prompt: lang === index.defaultLang ? 'Required' : 'Optional',
		});

		if (undefined === value) {
			return null;
		}

		texts.set(lang, value);
	}

	return texts;
}

function editKeysFile(edit, scope, name, id) {
	const lines = readFileSync(scope.keysFile, 'utf8').split('\n');
	const end = lines.findIndex((line) => line.startsWith(KEYS_END));

	if (-1 === end) {
		throw new Error(`Cannot find "${KEYS_END}" in ${scope.keysFile}`);
	}

	const position = new vscode.Position(end, 0);
	const value = scope.prefixed ? `${scope.name}.${id}` : id;
	const entry = `\t${name}: '${value}',\n`;

	edit.insert(vscode.Uri.file(scope.keysFile), position, entry);
}

function editTranslation(edit, translation, id, text) {
	if (!translation.exists || null === translation.data) {
		throw new Error(`Cannot write ${translation.file}`);
	}

	const content = `${JSON.stringify({ ...translation.data, [id]: text }, null, '\t')}\n`;
	const lines = readFileSync(translation.file, 'utf8').split('\n');
	const whole = new vscode.Range(0, 0, lines.length, 0);

	edit.replace(vscode.Uri.file(translation.file), whole, content);
}

function reference(document, scope, name) {
	const expression = `I18n.${scope}.${name}`;

	return 'html' === document?.languageId ? `{{ ${expression} | i18n }}` : expression;
}

function buildEdit(index, scopeName, name, texts, editor) {
	const scope = index.scopes.get(scopeName);
	const edit = new vscode.WorkspaceEdit();
	const id = ulid();
	const files = [scope.keysFile, ...index.langs.map((lang) => scope.translations.get(lang).file)];

	editKeysFile(edit, scope, name, id);

	for (const lang of index.langs) {
		const text = texts.get(lang);

		if ('' !== text.trim()) {
			editTranslation(edit, scope.translations.get(lang), id, text);
		}
	}

	if (undefined !== editor && false === editor.selection.isEmpty) {
		const value = reference(editor.document, scopeName, name);

		edit.replace(editor.document.uri, editor.selection, value);
	}

	return { edit, files };
}

async function save(files) {
	for (const file of files) {
		const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));

		await document.save();
	}
}

async function askKeyTexts(index, name, kind, editor) {
	const selected = false === editor?.selection.isEmpty;
	const seed = selected ? editor.document.getText(editor.selection).trim() : '';
	const texts =
		'plural' === kind ? await askPluralTexts(index, name, seed) : await askTexts(index, name, seed);

	return { selected, texts };
}

async function createKey(index, annotations) {
	const editor = vscode.window.activeTextEditor;
	const scope = await pickScope(index, editor?.document);

	if (null === scope) {
		return;
	}

	const name = await askName(index, scope);

	if (undefined === name) {
		return;
	}

	const kind = await askKind();

	if (null === kind) {
		return;
	}

	const { selected, texts } = await askKeyTexts(index, name, kind, editor);

	if (null === texts) {
		return;
	}

	const { edit, files } = buildEdit(index, scope, name, texts, editor);

	await vscode.workspace.applyEdit(edit);
	await save(files);

	if (selected && 'html' === editor.document.languageId) {
		await ensureTemplateSetup(editor.document.uri);
	}

	await index.reload();

	annotations.refreshAll();
	vscode.window.showInformationMessage(`i18n: ${scope}.${name} created`);
}

module.exports = { createKey, ulid };

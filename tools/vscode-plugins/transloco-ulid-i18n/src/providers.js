const vscode = require('vscode');

const { SELECTOR, locate, shorten, usageAt, usageRange } = require('./util');

const MISSING = '⚠️ _missing_';

function translationRows(index, scope, ulid) {
	return index.langs.map((lang) => {
		const { text, missing } = index.translation(scope, ulid, lang);

		return `| \`${lang}\` | ${missing ? MISSING : text.replace(/\|/g, '\\|')} |`;
	});
}

function hoverContent(index, usage) {
	const entry = index.entry(usage.scope, usage.key);

	if (null === entry) {
		return new vscode.MarkdownString(`⚠️ \`${usage.key}\` is not declared in \`${usage.scope}\``);
	}

	const markdown = new vscode.MarkdownString(
		[
			`**${usage.scope}.${usage.key}**`,
			'',
			'| | |',
			'| --- | --- |',
			...translationRows(index, usage.scope, entry.ulid),
			'',
			`\`${entry.value}\``,
		].join('\n'),
	);

	markdown.supportHtml = false;

	return markdown;
}

function hoverProvider(index) {
	return vscode.languages.registerHoverProvider(SELECTOR, {
		provideHover(document, position) {
			const usage = usageAt(index, document, position);

			return null === usage
				? null
				: new vscode.Hover(hoverContent(index, usage), usageRange(document, usage));
		},
	});
}

function definitionTargets(index, usage) {
	const entry = index.entry(usage.scope, usage.key);

	if (null === entry) {
		return [];
	}

	const scope = index.scopes.get(usage.scope);
	const targets = index.langs
		.map((lang) => locate(index.translation(usage.scope, entry.ulid, lang).file, entry.ulid))
		.filter((target) => null !== target);

	return [...targets, locate(scope.keysFile, `${usage.key}:`)].filter((target) => null !== target);
}

function definitionProvider(index) {
	return vscode.languages.registerDefinitionProvider(SELECTOR, {
		provideDefinition(document, position) {
			const usage = usageAt(index, document, position);

			return null === usage ? null : definitionTargets(index, usage);
		},
	});
}

function keyItems(index, scope) {
	return index.keysOf(scope).map((key) => {
		const entry = index.entry(scope, key);
		const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Constant);
		const { text, missing } = index.translation(scope, entry.ulid, index.defaultLang);

		item.detail = missing ? '⚠️ missing translation' : shorten(text, 60);
		item.documentation = new vscode.MarkdownString(
			index.langs
				.map((lang) => {
					const value = index.translation(scope, entry.ulid, lang);

					return `- \`${lang}\` ${value.missing ? MISSING : value.text}`;
				})
				.join('\n'),
		);

		return item;
	});
}

function scopeItems(index) {
	return index.scopeNames().map((name) => {
		const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);

		item.detail = `${index.keysOf(name).length} key(s)`;

		return item;
	});
}

function completionsFor(index, prefix) {
	const barrelScope = /\bI18n\s*\.\s*([a-z][A-Za-z0-9]*)\s*\.\s*$/.exec(prefix);
	const constScope = /\b([A-Z][A-Za-z0-9]*)I18n\s*\.\s*$/.exec(prefix);
	const scope = barrelScope?.[1] ?? constScope?.[1];

	if (0 === index.scopes.size) {
		return null;
	}

	if (undefined !== scope) {
		return keyItems(index, index.toKebabCase(scope));
	}

	return /\bI18n\s*\.\s*$/.test(prefix) ? scopeItems(index) : null;
}

function completionProvider(index) {
	return vscode.languages.registerCompletionItemProvider(
		SELECTOR,
		{
			provideCompletionItems(document, position) {
				const prefix = document.getText(
					new vscode.Range(new vscode.Position(position.line, 0), position),
				);

				return completionsFor(index, prefix);
			},
		},
		'.',
	);
}

module.exports = { completionProvider, definitionProvider, hoverProvider };

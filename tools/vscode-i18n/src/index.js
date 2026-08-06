const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCRIPTS_DIR = path.join('tools', 'scripts', 'i18n');

const loadModule = (root, file) => import(pathToFileURL(path.join(root, SCRIPTS_DIR, file)).href);

class I18nIndex {
	constructor(root) {
		this.root = root;
		this.langs = [];
		this.defaultLang = 'en';
		this.i18nDir = '';
		this.scopes = new Map();
		this.patterns = [];
		this.error = null;
	}

	entry(scopeName, keyName) {
		return this.scopes.get(scopeName)?.entries.get(keyName) ?? null;
	}

	findUsages(text) {
		const usages = [];

		for (const pattern of this.patterns) {
			for (const match of text.matchAll(pattern)) {
				const [expression, scopeToken, key] = match;

				usages.push({
					scope: this.toKebabCase(scopeToken),
					key,
					start: match.index,
					end: match.index + expression.length,
				});
			}
		}

		return usages.sort((left, right) => left.start - right.start);
	}

	keysOf(scopeName) {
		return [...(this.scopes.get(scopeName)?.entries.keys() ?? [])];
	}

	async reload(langsOverride) {
		try {
			await this.readWorkspace(langsOverride);
			this.error = null;
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
			this.scopes = new Map();
		}

		return this.error;
	}

	scopeNames() {
		return [...this.scopes.keys()];
	}

	translation(scopeName, ulid, lang) {
		const source = this.scopes.get(scopeName)?.translations.get(lang);

		if (!source?.data) {
			return { file: source?.file ?? null, text: null, missing: true };
		}

		const text = source.data[ulid];

		return {
			file: source.file,
			text: text ?? null,
			missing: undefined === text || '' === String(text).trim(),
		};
	}

	async readWorkspace(langsOverride) {
		const config = await loadModule(this.root, 'config.mjs');
		const collect = await loadModule(this.root, 'collect.mjs');

		this.toKebabCase = config.toKebabCase;
		this.patterns = collect.USAGE_PATTERNS;
		this.langs = langsOverride?.length ? langsOverride : config.DEFAULTS.langs;
		this.defaultLang = this.langs[0] ?? config.DEFAULTS.defaultLang;
		this.i18nDir = path.join(this.root, config.DEFAULTS.i18nDir);

		const scopes = collect.readScopes({ i18nDir: this.i18nDir, langs: this.langs });

		this.scopes = new Map(scopes.map((scope) => [scope.name, this.toScope(scope)]));
	}

	toScope(scope) {
		const entries = scope.keys?.entries ?? [];

		return {
			name: scope.name,
			dir: scope.dir,
			keysFile: scope.keysFile,
			prefixed: scope.prefixed,
			constName: scope.keys?.constName ?? null,
			entries: new Map(entries.map((entry) => [entry.name, entry])),
			translations: scope.translations,
		};
	}
}

module.exports = { I18nIndex };

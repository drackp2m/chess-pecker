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
		this.sourceDirs = [];
		this.scopes = new Map();
		this.rawScopes = [];
		this.modules = null;
		this.patterns = [];
		this.declaredParams = new Map();
		this.error = null;
	}

	entry(scopeName, keyName) {
		return this.scopes.get(scopeName)?.entries.get(keyName) ?? null;
	}

	entryByUlid(scopeName, ulid) {
		const entries = this.scopes.get(scopeName)?.entries.values() ?? [];

		return [...entries].find((entry) => entry.ulid === ulid) ?? null;
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

	paramsOf(scopeName, keyName) {
		const entry = this.entry(scopeName, keyName);
		const declared = this.declaredParams.get(entry?.value);

		return undefined === declared ? [] : [...declared].map(([name, type]) => ({ name, type }));
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
			this.rawScopes = [];
		}

		return this.error;
	}

	scopeAt(dir) {
		return [...this.scopes.values()].find((scope) => scope.dir === dir) ?? null;
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

	load(file) {
		return loadModule(this.root, file);
	}

	async loadModules() {
		const files = ['checks.mjs', 'collect.mjs', 'config.mjs', 'findings.mjs', 'params.mjs'];
		const [checks, collect, config, findings, params] = await Promise.all(
			files.map((file) => loadModule(this.root, file)),
		);

		return { checks, collect, config, findings, params };
	}

	async readWorkspace(langsOverride) {
		const modules = await this.loadModules();
		const { collect, config, params } = modules;

		this.modules = modules;
		this.toKebabCase = config.toKebabCase;
		this.patterns = collect.USAGE_PATTERNS;
		this.langs = langsOverride?.length ? langsOverride : config.DEFAULTS.langs;
		this.defaultLang = this.langs[0] ?? config.DEFAULTS.defaultLang;
		this.i18nDir = path.join(this.root, config.DEFAULTS.i18nDir);
		this.sourceDirs = config.DEFAULTS.sourceDirs.map((dir) => path.join(this.root, dir));

		const scopes = collect.readScopes({ i18nDir: this.i18nDir, langs: this.langs });

		this.rawScopes = scopes;
		this.scopes = new Map(scopes.map((scope) => [scope.name, this.toScope(scope)]));
		this.declaredParams = this.readParams(params, scopes);
	}

	readParams(params, scopes) {
		const declared = new Map();

		for (const scope of scopes) {
			for (const [key, fields] of params.readDeclaredParams(params.paramsFile(scope.dir))) {
				declared.set(key, fields);
			}
		}

		return declared;
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

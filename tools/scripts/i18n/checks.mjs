import { isUlid, toPascalCase } from './config.mjs';

const PARAM_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

const finding = (type, scope, file, message, line = null) => ({ type, scope, file, message, line });

const paramsOf = (value) => new Set([...String(value).matchAll(PARAM_PATTERN)].map(([, n]) => n));

const expectedValue = (scope, ulid) => (scope.prefixed ? `${scope.name}.${ulid}` : ulid);

function checkLangFiles(scope, langs) {
	const findings = [];

	for (const lang of langs) {
		const { file, exists, error } = scope.translations.get(lang);

		if (!exists) {
			findings.push(finding('missing-lang-file', scope.name, file, 'file not found'));
		} else if (error) {
			findings.push(finding('invalid-json', scope.name, file, error));
		}
	}

	return findings;
}

function checkStructure(scope, langs) {
	const findings = checkLangFiles(scope, langs);

	if (!scope.keys) {
		findings.push(finding('missing-keys-file', scope.name, scope.keysFile, 'keys.ts not found'));

		return findings;
	}

	const expected = `${toPascalCase(scope.name)}I18n`;

	if (scope.keys.constName !== expected) {
		const message = `exports "${scope.keys.constName}", expected "${expected}"`;

		findings.push(finding('bad-const-name', scope.name, scope.keysFile, message));
	}

	return findings;
}

function checkKeys(scope, seenUlids) {
	const findings = [];

	for (const { name, value, ulid, line } of scope.keys.entries) {
		const previous = seenUlids.get(ulid);

		if (!isUlid(ulid)) {
			findings.push(
				finding('invalid-ulid', scope.name, scope.keysFile, `${name} = "${value}"`, line),
			);
		} else if (value !== expectedValue(scope, ulid)) {
			const message = `${name} = "${value}", expected "${expectedValue(scope, ulid)}"`;

			findings.push(finding('bad-scope-prefix', scope.name, scope.keysFile, message, line));
		} else if (previous) {
			const message = `${name} reuses the ULID of ${previous}`;

			findings.push(finding('duplicate-ulid', scope.name, scope.keysFile, message, line));
		} else {
			seenUlids.set(ulid, `${scope.name}.${name}`);
		}
	}

	return findings;
}

function checkDeclared(declared, file, data, scopeName) {
	const findings = [];

	for (const [ulid, name] of declared) {
		if (!(ulid in data)) {
			findings.push(finding('missing-translation', scopeName, file, `${name} (${ulid})`));
		} else if ('' === String(data[ulid]).trim()) {
			findings.push(finding('empty-translation', scopeName, file, `${name} (${ulid})`));
		}
	}

	return findings;
}

function checkOrphans(declared, file, data, scopeName) {
	return Object.keys(data)
		.filter((ulid) => !declared.has(ulid))
		.map((ulid) => finding('orphan-translation', scopeName, file, `${ulid} is not declared`));
}

function checkTranslations(scope, langs) {
	const declared = new Map(scope.keys.entries.map(({ ulid, name }) => [ulid, name]));
	const findings = [];

	for (const lang of langs) {
		const { file, data } = scope.translations.get(lang);

		if (data) {
			findings.push(...checkDeclared(declared, file, data, scope.name));
			findings.push(...checkOrphans(declared, file, data, scope.name));
		}
	}

	return findings;
}

function checkUsage(scope, usages) {
	return scope.keys.entries
		.filter(({ name }) => !usages.has(`${scope.name}:${name}`))
		.map(({ name, line }) =>
			finding('unused-key', scope.name, scope.keysFile, `${name} is never referenced`, line),
		);
}

function comparePairs(base, data, file, scopeName) {
	const findings = [];

	for (const [ulid, value] of Object.entries(data)) {
		if (!(ulid in base)) {
			continue;
		}

		const actual = paramsOf(value);
		const missing = [...paramsOf(base[ulid])].filter((name) => !actual.has(name));

		if (missing.length) {
			const message = `${ulid} drops {{ ${missing.join(' }}, {{ ')} }}`;

			findings.push(finding('param-mismatch', scopeName, file, message));
		}
	}

	return findings;
}

function checkParams(scope, langs, defaultLang) {
	const base = scope.translations.get(defaultLang)?.data;
	const findings = [];

	if (!base) {
		return findings;
	}

	for (const lang of langs.filter((entry) => entry !== defaultLang)) {
		const { file, data } = scope.translations.get(lang);

		if (data) {
			findings.push(...comparePairs(base, data, file, scope.name));
		}
	}

	return findings;
}

export function buildFindings({ scopes, usages, langs, defaultLang }) {
	const seenUlids = new Map();
	const findings = [];

	for (const scope of scopes) {
		findings.push(...checkStructure(scope, langs));

		if (!scope.keys) {
			continue;
		}

		findings.push(...checkKeys(scope, seenUlids));
		findings.push(...checkTranslations(scope, langs));
		findings.push(...checkUsage(scope, usages));
		findings.push(...checkParams(scope, langs, defaultLang));
	}

	return findings;
}

import path from 'node:path';

const R = '\x1b[0m';
const B = '\x1b[1m';
const D = '\x1b[90m';
const C = '\x1b[94m';
const G = '\x1b[92m';
const Y = '\x1b[93m';
const RD = '\x1b[91m';

const LEVELS = {
	'missing-keys-file': ['error', 'Scopes without keys.ts'],
	'missing-lang-file': ['error', 'Missing language files'],
	'invalid-json': ['error', 'Malformed JSON'],
	'bad-const-name': ['error', 'Unexpected exported constant'],
	'invalid-ulid': ['error', 'Keys whose value is not a ULID'],
	'bad-scope-prefix': ['error', 'Keys whose value does not match their scope'],
	'duplicate-ulid': ['error', 'ULIDs declared more than once'],
	'missing-translation': ['error', 'Declared keys with no entry'],
	'param-mismatch': ['error', 'Interpolations lost in translation'],
	'empty-translation': ['warn', 'Entries with an empty value'],
	'orphan-translation': ['warn', 'Entries not declared in keys.ts'],
	'unused-key': ['warn', 'Declared keys never referenced'],
};

const levelOf = (type) => LEVELS[type]?.[0] ?? 'warn';

const shortPath = (file) => path.relative(process.cwd(), file) || file;

const groupByType = (findings) => {
	const groups = new Map();

	for (const item of findings) {
		groups.set(item.type, [...(groups.get(item.type) ?? []), item]);
	}

	return groups;
};

function printGroup(type, items) {
	const [level, title] = LEVELS[type] ?? ['warn', type];
	const color = 'error' === level ? RD : Y;

	console.log(`${color}${B}${'error' === level ? '✖' : '⚠'} ${title}${R} ${D}(${type})${R}`);

	for (const { scope, file, line, message } of items) {
		const at = line ? `${shortPath(file)}:${line}` : shortPath(file);

		console.log(`  ${D}${at}${R} ${C}${scope}${R} ${message}`);
	}

	console.log('');
}

export function printFindings(findings, { scopes, langs }) {
	console.log(`🔍 ${B}${scopes.length}${R} scope(s), ${B}${langs.join(', ')}${R}\n`);

	if (!findings.length) {
		console.log(`✅ ${G}Every key is declared, translated and used.${R}`);

		return 0;
	}

	for (const [type, items] of groupByType(findings)) {
		printGroup(type, items);
	}

	const errors = findings.filter(({ type }) => 'error' === levelOf(type)).length;
	const warnings = findings.length - errors;

	console.log(`${B}${RD}${errors} error(s)${R}, ${B}${Y}${warnings} warning(s)${R}`);

	return 0 === errors ? 0 : 1;
}

export function printWritten(written) {
	for (const file of written) {
		console.log(`✏️  ${C}${shortPath(file)}${R}`);
	}

	console.log(`\n✅ ${G}${written.length} file(s) updated.${R}`);
}

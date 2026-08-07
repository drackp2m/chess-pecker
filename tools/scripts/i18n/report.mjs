import path from 'node:path';

import { c, plural, printProblems, printTally } from '../lint/lint-report.mjs';

const ERROR_TYPES = new Set([
	'missing-keys-file',
	'missing-lang-file',
	'invalid-json',
	'bad-const-name',
	'invalid-ulid',
	'bad-scope-prefix',
	'duplicate-ulid',
	'missing-translation',
	'param-mismatch',
	'stale-params',
	'missing-params-file',
	'missing-barrel',
	'unregistered-scope',
	'unregistered-params',
]);

const INFO_TYPES = new Set(['commented-usage']);

const FIXABLE_TYPES = new Set([
	'stale-params',
	'missing-params-file',
	'missing-translation',
	'unregistered-scope',
	'orphan-translation',
]);

const KEYS_COLUMN = 'keys';
const PARAMS_COLUMN = 'params';
const NAME_COLUMN = 'scope';
const OK = `${c.green}✔${c.reset}`;
const WARN = `${c.yellow}⚠${c.reset}`;
const FAIL = `${c.red}✖${c.reset}`;

const severityOf = (type) => {
	if (ERROR_TYPES.has(type)) {
		return 'error';
	}

	return INFO_TYPES.has(type) ? 'info' : 'warning';
};

const fullPath = (file) => path.resolve(file);

const columnOf = (item) => item.lang ?? item.column ?? KEYS_COLUMN;

const padIcon = (icon, column) => `${icon}${' '.repeat(Math.max(0, column.length - 1))}`;

// Infos never turn a cell yellow: they aren't problems, so a column with only
// a note (e.g. a key referenced from a comment) still reads as OK.
function statusOf(items) {
	const relevant = items.filter(({ type }) => 'info' !== severityOf(type));

	if (relevant.some(({ type }) => 'error' === severityOf(type))) {
		return FAIL;
	}

	return 0 === relevant.length ? OK : WARN;
}

function tableRow(scope, findings, columns) {
	const mine = findings.filter((item) => item.scope === scope.name);

	return {
		name: scope.name,
		cells: columns.map((column) => statusOf(mine.filter((item) => columnOf(item) === column))),
	};
}

function printTable(scopes, findings, langs) {
	const columns = [KEYS_COLUMN, PARAMS_COLUMN, ...langs];
	const rows = scopes.map((scope) => tableRow(scope, findings, columns));
	const nameWidth = Math.max(...rows.map((row) => row.name.length), NAME_COLUMN.length);

	console.log(`\n  ${c.dim}${NAME_COLUMN.padEnd(nameWidth)}  ${columns.join('  ')}${c.reset}`);

	for (const { name, cells } of rows) {
		const painted = cells.map((cell, index) => padIcon(cell, columns[index]));

		console.log(`  ${c.cyan}${name.padEnd(nameWidth)}${c.reset}  ${painted.join('  ')}`);
	}
}

function toProblems(findings) {
	const order = [...new Set(findings.map(({ file }) => file))];

	return findings
		.map((item) => ({
			file: fullPath(item.file),
			...(null === item.line ? {} : { line: item.line, col: item.col ?? 1 }),
			severity: severityOf(item.type),
			message: item.message,
			rule: item.type,
			order: order.indexOf(item.file),
		}))
		.sort((left, right) => left.order - right.order || (left.line ?? 0) - (right.line ?? 0));
}

function printFixable(findings) {
	const fixable = findings.filter(({ type }) => FIXABLE_TYPES.has(type)).length;

	if (0 !== fixable) {
		const message = `${plural(fixable, 'problem')} potentially fixable with the --fix option.`;

		console.log(`  ${c.dim}${message}${c.reset}`);
	}
}

// Infos are surfaced but kept out of "Problems" entirely — they never reach
// the tally, the --fix hint, or the exit code, so 0 problems always means CI
// exits 0 even when notes are printed above it.
export function printFindings(findings, { scopes, langs, fix }) {
	printTable(scopes, findings, langs);

	const infos = toProblems(findings.filter((item) => 'info' === severityOf(item.type)));
	const problems = toProblems(findings.filter((item) => 'info' !== severityOf(item.type)));

	if (0 === problems.length) {
		console.log(`\n  ${c.green}✔ Every key is declared, translated and used.${c.reset}`);
	} else {
		console.log(`\n${c.bold}${c.cyan}━━ Problems ━━${c.reset}`);
		printProblems(problems);
		printTally(problems);

		if (!fix) {
			printFixable(findings);
		}
	}

	if (0 !== infos.length) {
		console.log(`\n${c.bold}${c.cyan}━━ Info ━━${c.reset}`);
		printProblems(infos);
		console.log(`\n  ${c.blue}ℹ${c.reset} ${plural(infos.length, 'note')}`);
	}

	return problems.some(({ severity }) => 'error' === severity) ? 1 : 0;
}

export function printWritten(written) {
	if (0 === written.length) {
		console.log(`\n  ${c.dim}✓ Nothing to write${c.reset}`);

		return;
	}

	console.log(`\n  ${c.dim}Files written:${c.reset}`);

	for (const file of written) {
		console.log(`      ${fullPath(file)}`);
	}

	console.log(`\n  ${c.green}✔ ${plural(written.length, 'file')} updated${c.reset}`);
}

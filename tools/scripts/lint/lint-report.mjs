// ANSI colors + summary rendering for the lint script: a fixed/left header per
// tool plus, for the problems left, an ESLint-stylish block (file header +
// aligned line:col/severity/message/rule rows) the editor turns into links.

export const c = {
	reset: '\x1b[0m',
	dim: '\x1b[2m',
	bold: '\x1b[1m',
	underline: '\x1b[4m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	red: '\x1b[31m',
	cyan: '\x1b[36m',
	blue: '\x1b[34m',
};

const SEVERITY_COLOR = { error: c.red, warning: c.yellow, info: c.blue };

export const plural = (value, word) => `${value} ${word}${1 === value ? '' : 's'}`;

const locationOf = (item) => (undefined !== item.line ? `${item.line}:${item.col}` : '');

export function printProblems(problems) {
	const byFile = new Map();

	for (const problem of problems) {
		if (!byFile.has(problem.file)) {
			byFile.set(problem.file, []);
		}
		byFile.get(problem.file).push(problem);
	}

	for (const [file, items] of byFile) {
		const locWidth = Math.max(...items.map((item) => locationOf(item).length));
		const sevWidth = Math.max(...items.map((item) => item.severity.length));
		const msgWidth = Math.max(...items.map((item) => item.message.length));

		console.log(`\n${c.underline}${file}${c.reset}`);

		for (const item of items) {
			const location = locationOf(item).padEnd(locWidth);
			const color = SEVERITY_COLOR[item.severity] ?? c.yellow;
			const severity = item.severity.padEnd(sevWidth);
			const rule = item.rule ? `${c.dim}${item.rule}${c.reset}` : '';
			console.log(
				`  ${c.dim}${location}${c.reset}  ${color}${severity}${c.reset}  ` +
					`${item.message.padEnd(msgWidth)}  ${rule}`,
			);
		}
	}
}

// The error/warning tally ESLint prints under the problems. Callers keep info
// findings out of this list entirely — they are not problems, so they never
// reach this tally or the CI exit code.
export function printTally(problems) {
	const errors = problems.filter((problem) => 'error' === problem.severity).length;
	const warnings = problems.length - errors;
	const icon = 0 !== errors ? `${c.red}✖${c.reset}` : `${c.yellow}⚠${c.reset}`;
	const errorBlock =
		0 !== errors ? `${c.red}${plural(errors, 'error')}${c.reset}` : plural(errors, 'error');
	const warningBlock =
		0 !== warnings
			? `${c.yellow}${plural(warnings, 'warning')}${c.reset}`
			: plural(warnings, 'warning');

	console.log(`\n  ${icon} ${plural(problems.length, 'problem')} (${errorBlock}, ${warningBlock})`);
}

function printRemaining(remaining) {
	console.log(`  ${c.dim}Files with problems:${c.reset}`);
	printProblems(remaining);
	printTally(remaining);
}

function printFixed(fixed, printedBlock) {
	console.log(`${printedBlock ? '\n' : ''}  ${c.dim}Files fixed automatically:${c.reset}`);

	for (const entry of fixed) {
		const fixes = null !== entry.count ? `  ${c.dim}(${entry.count})${c.reset}` : '';
		console.log(`      ${entry.file}${fixes}`);
	}

	const total = fixed.reduce((sum, entry) => sum + (entry.count ?? 0), 0);
	const tally = 0 !== total ? ` ${c.dim}· ${plural(total, 'correction')}${c.reset}` : '';
	console.log(`\n  ${c.green}✔ ${plural(fixed.length, 'file')} fixed${c.reset}${tally}`);
}

export function printSection(name, { fixed, remaining, skipped }) {
	console.log(`\n${c.bold}${c.cyan}━━ ${name} ━━${c.reset}`);

	if (skipped) {
		console.log(`  ${c.dim}⊘ skipped — no matching files${c.reset}`);

		return;
	}

	if (0 === fixed.length && 0 === remaining.length) {
		console.log(`  ${c.dim}✓ No problems${c.reset}`);

		return;
	}

	const printedBlock = 0 !== remaining.length;

	if (printedBlock) {
		printRemaining(remaining);
	}

	if (0 !== fixed.length) {
		printFixed(fixed, printedBlock);
	}
}

export function printUncovered(files) {
	if (0 === files.length) {
		return;
	}

	console.log(`\n${c.bold}${c.cyan}━━ Uncovered ━━${c.reset}`);
	console.log(`  ${c.yellow}⚠ ${plural(files.length, 'file')} no linter handled${c.reset}`);

	for (const file of files) {
		console.log(`      ${file}`);
	}
}

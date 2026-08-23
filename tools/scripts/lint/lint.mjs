#!/usr/bin/env node
// Runs ESLint → Stylelint → Prettier and prints one ESLint-stylish summary per tool.
// Check by default; --fix applies every safe fix and --verbose adds per-file counts.

import { writeLintSummary } from '../lint/github-summary.mjs';
import { c, plural, printSection, printUncovered } from '../lint/lint-report.mjs';
import {
	ESLINT_EXT,
	STYLELINT_EXT,
	findUncovered,
	runEslint,
	runPrettier,
	runStylelint,
	withExt,
} from '../lint/lint-runners.mjs';
import { repoFiles } from '../lint/walk-files.mjs';

function parseMaxWarnings(list) {
	const equalsArg = list.find((arg) => arg.startsWith('--max-warnings='));

	if (undefined !== equalsArg) {
		return { limit: Number(equalsArg.slice('--max-warnings='.length)), valueIndex: -1 };
	}

	const flagIndex = list.indexOf('--max-warnings');

	if (-1 === flagIndex) {
		return { limit: null, valueIndex: -1 };
	}

	return { limit: Number(list[flagIndex + 1]), valueIndex: flagIndex + 1 };
}

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const verbose = args.includes('--verbose');
const maxWarnings = parseMaxWarnings(args);
const argFiles = args.filter(
	(arg, index) => !arg.startsWith('--') && index !== maxWarnings.valueIndex,
);
const hasFiles = 0 !== argFiles.length;

if (null !== maxWarnings.limit && (!Number.isInteger(maxWarnings.limit) || 0 > maxWarnings.limit)) {
	console.error(`${c.red}--max-warnings expects a non-negative integer.${c.reset}`);
	process.exit(2);
}

// ESLint and Stylelint are handed "." or a glob and filter through their own ignore config;
// Prettier works file by file, so `repoFiles()` walks the tree to build it a concrete list.
const eslintTargets = hasFiles ? withExt(argFiles, ESLINT_EXT) : ['.'];
const stylelintTargets = hasFiles
	? withExt(argFiles, STYLELINT_EXT)
	: STYLELINT_EXT.map((ext) => `**/*${ext}`);
const prettierTargets = hasFiles ? argFiles : repoFiles();

const jobs = [
	['ESLint', () => runEslint(eslintTargets, fix, verbose)],
	['Stylelint', () => runStylelint(stylelintTargets, fix, verbose)],
	['Prettier', () => runPrettier(prettierTargets, fix)],
];

const segments = [fix ? 'fix' : 'check'];

if (fix && verbose) {
	segments.push('verbose');
}

if (null !== maxWarnings.limit) {
	segments.push(`max-warnings ${maxWarnings.limit}`);
}

segments.push(hasFiles ? plural(argFiles.length, 'file') : 'whole repo');

const runDescription = `ESLint → Stylelint → Prettier · ${segments.join(' · ')}`;

console.log(`${c.bold}Linting...${c.reset} ${c.dim}(${runDescription})${c.reset}`);

let errors = 0;
let warnings = 0;
const summaryRows = [];

for (const [name, run] of jobs) {
	const result = await run();
	printSection(name, result);
	const jobErrors = result.remaining.filter((problem) => 'error' === problem.severity).length;
	const jobWarnings = result.remaining.filter((problem) => 'warning' === problem.severity).length;
	errors += jobErrors;
	warnings += jobWarnings;
	summaryRows.push({ name, errors: jobErrors, warnings: jobWarnings, skipped: result.skipped });
}

const tooManyWarnings = null !== maxWarnings.limit && warnings > maxWarnings.limit;

if (tooManyWarnings) {
	const verb = 1 === warnings ? 'exceeds' : 'exceed';
	console.log(
		`\n${c.yellow}⚠ ${plural(warnings, 'warning')} ${verb} the --max-warnings ${maxWarnings.limit} limit.${c.reset}`,
	);
}

// Only when explicit files are passed: warn about any nothing handled.
if (hasFiles) {
	printUncovered(await findUncovered(argFiles));
}

writeLintSummary({
	rows: summaryRows,
	errors,
	warnings,
	maxWarnings: maxWarnings.limit,
	details: runDescription,
});

// Non-zero exit on any error so CI and pre-commit hooks block; warnings only block when
// --max-warnings caps them.
process.exitCode = 0 !== errors || tooManyWarnings ? 1 : 0;

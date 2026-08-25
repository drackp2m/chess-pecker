#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { inStepSummary, writeStepSummary } from '../util/github-summary.mjs';

// TypeScript is a root devDependency — the API has none of its own — so the version that
// actually ran the check lives in the workspace manifest.
function typescriptVersion() {
	try {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

		return pkg.devDependencies?.typescript ?? 'unknown';
	} catch {
		return 'unknown';
	}
}

// `tsc --noEmit` says nothing when it passes, so the numbers come from `--diagnostics`.
// Errors are counted from the diagnostic lines, since the footer changes shape with `--pretty`.
const STAT_LINE = /^(?<name>[A-Za-z][\w /]*):\s+(?<value>\S+)$/gmu;
const ERROR_LINE = /^(?<file>[^\s(].*)\(\d+,\d+\):\s+error\s+TS\d+:/gmu;

function parseTypecheckLog(log) {
	const stats = new Map();

	for (const { groups } of log.matchAll(STAT_LINE)) {
		stats.set(groups.name, groups.value);
	}

	const files = new Set();
	let errors = 0;

	for (const { groups } of log.matchAll(ERROR_LINE)) {
		files.add(groups.file);
		errors += 1;
	}

	return {
		stats,
		errors,
		errorFiles: files.size,
		// The block is only missing when tsc never got as far as building a program —
		// a bad `-p`, a malformed tsconfig. Type errors do not suppress it.
		completed: stats.has('Files'),
	};
}

function plural(count, word) {
	return 1 === count ? `${count} ${word}` : `${count} ${word}s`;
}

function stat(stats, name) {
	return stats.get(name) ?? '—';
}

function typecheckSummary(metrics) {
	const header = ['## Typecheck Report', '', `_TypeScript ${typescriptVersion()}_`, ''];

	if (!metrics.completed) {
		return [...header, '> ❌ Typecheck did not run — check the step log.', ''];
	}

	const rows = [
		`- **Program:** ${stat(metrics.stats, 'Files')} files · ${stat(metrics.stats, 'Lines')} lines`,
		`- **Types:** ${stat(metrics.stats, 'Types')} types · ${stat(metrics.stats, 'Instantiations')} instantiations`,
		`- **Check time:** ⏱️ ${stat(metrics.stats, 'Check time')} · ${stat(metrics.stats, 'Total time')} total`,
	];

	const verdict =
		0 === metrics.errors
			? '> ✅ No type errors.'
			: `> ❌ ${plural(metrics.errors, 'error')} in ${plural(metrics.errorFiles, 'file')}.`;

	return [...header, '### Summary', '', ...rows, '', verdict, ''];
}

function main() {
	if (!inStepSummary()) {
		return;
	}

	let log;

	try {
		log = readFileSync(process.argv[2] ?? '', 'utf8');
	} catch {
		log = '';
	}

	writeStepSummary(typecheckSummary(parseTypecheckLog(log)).join('\n'));
}

try {
	main();
} catch {
	process.exit(0);
}

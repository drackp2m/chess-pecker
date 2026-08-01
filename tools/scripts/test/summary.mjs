#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { inStepSummary, writeStepSummary } from '../util/github-summary.mjs';

// Vitest keeps colouring its output on Actions, so the counts arrive wrapped in
// escape sequences and none of the patterns below match without this.
function stripAnsi(text) {
	// eslint-disable-next-line no-control-regex
	return text.replace(/\u001B\[[\d;]*m/gu, '');
}

function parseCounts(line) {
	if (null === line) {
		return null;
	}

	const counts = {};

	for (const [, amount, state] of line[1].matchAll(/(\d+) (\w+)/gu)) {
		counts[state] = Number(amount);
	}

	return { ...counts, total: Number(line[2]) };
}

function parseVitestLog(log) {
	const clean = stripAnsi(log);

	return {
		files: parseCounts(clean.match(/Test Files\s+(.+?)\s+\((\d+)\)/u)),
		tests: parseCounts(clean.match(/Tests\s+(.+?)\s+\((\d+)\)/u)),
		duration: clean.match(/Duration\s+([\d.]+\s*m?s)/u)?.[1] ?? null,
		vitestVersion: clean.match(/RUN\s+v([\d.]+)/u)?.[1] ?? null,
	};
}

function countsLine(counts) {
	const order = ['failed', 'passed', 'skipped', 'todo'];
	const parts = order
		.filter((state) => undefined !== counts[state])
		.map((state) => `${counts[state]} ${state}`);

	return `${parts.join(' · ')} (${counts.total})`;
}

function buildSummary(metrics, label) {
	const title = undefined === label ? '# Test Report' : `# Test Report — ${label}`;
	const header = [title, '', `_vitest ${metrics.vitestVersion ?? 'unknown'}_`, ''];

	if (null === metrics.tests || null === metrics.files) {
		return [...header, '> ❌ Test run did not complete — check the step log.', ''];
	}

	const failed = metrics.tests.failed ?? 0;
	const rows = [
		`- **Test files:** ${countsLine(metrics.files)}`,
		`- **Tests:** ${0 === failed ? '✅' : '❌'} ${countsLine(metrics.tests)}`,
	];

	if (null !== metrics.duration) {
		rows.push(`- **Duration:** ⏱️ ${metrics.duration}`);
	}

	const verdict =
		0 === failed
			? '> ✅ All tests passed.'
			: `> ❌ ${failed} test${1 === failed ? '' : 's'} failed.`;

	return [...header, '## Summary', '', ...rows, '', verdict, ''];
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

	writeStepSummary(buildSummary(parseVitestLog(log), process.argv[3]).join('\n'));
}

try {
	main();
} catch {
	process.exit(0);
}

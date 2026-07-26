#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { inStepSummary, writeStepSummary } from '../util/github-summary.mjs';

function angularVersion() {
	try {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

		return pkg.dependencies?.['@angular/core'] ?? 'unknown';
	} catch {
		return 'unknown';
	}
}

function parseBuildLog(log) {
	const initial = log.match(/Initial total\s*\|\s*([\d.]+ \w+)\s*\|\s*([\d.]+ \w+)/);
	const budget = log.match(
		/Budget ([\d.]+ \w+) was not met by ([\d.]+ \w+) with a total of ([\d.]+ \w+)/,
	);
	const done = log.match(/Application bundle generation complete\. \[([\d.]+) seconds\]/);

	return {
		initialRaw: null === initial ? null : initial[1],
		initialTransfer: null === initial ? null : initial[2],
		budget: null === budget ? null : { limit: budget[1], over: budget[2], total: budget[3] },
		lazyChunks: (log.match(/^chunk-[\w-]+\.[a-z]+\s*\|/gm) ?? []).length,
		seconds: null === done ? null : Number(done[1]),
		completed: null !== done,
	};
}

function buildSummary(metrics) {
	const header = ['# Build Report', '', `_Angular ${angularVersion()}_`, ''];

	if (!metrics.completed) {
		return [...header, '> ❌ Build did not complete — check the step log.', ''];
	}

	const budgetRow =
		null === metrics.budget
			? '- **Budget:** ✅ Within budget'
			: `- **Budget:** ⚠️ Over by ${metrics.budget.over} · limit ${metrics.budget.limit}`;

	const rows = [
		`- **Initial total:** ${metrics.initialRaw ?? '—'} raw · ${metrics.initialTransfer ?? '—'} transfer`,
		budgetRow,
		`- **Lazy chunks:** ${metrics.lazyChunks} files`,
		`- **Build time:** ⏱️ ${metrics.seconds}s`,
	];

	const verdict =
		null === metrics.budget
			? '> ✅ Build completed.'
			: '> ⚠️ Build completed with budget warnings.';

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

	writeStepSummary(buildSummary(parseBuildLog(log)).join('\n'));
}

try {
	main();
} catch {
	process.exit(0);
}

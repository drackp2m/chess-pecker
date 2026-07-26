#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { inStepSummary, writeStepSummary } from '../util/github-summary.mjs';

function parseReleaseLog(log) {
	const version = log.match(/Running semantic-release version ([\d.]+)/);
	const previous = log.match(/Found git tag (v[\d.]+)/);
	const commits = log.match(/Found (\d+) commits? since last release/);
	const bump = log.match(/Analysis of \d+ commits complete: (\S+) release/);
	const next = log.match(/The next release version is ([\d.]+)/);

	return {
		version: null === version ? null : version[1],
		previous: null === previous ? null : previous[1],
		commits: null === commits ? null : Number(commits[1]),
		bump: null === bump ? null : bump[1],
		nextVersion: null === next ? null : next[1],
		released: null !== next,
		noRelease: /no new version is released/.test(log),
	};
}

function buildSummary(metrics) {
	const header = [
		'# Semantic Release Report',
		'',
		`_semantic-release ${metrics.version ?? 'unknown'}_`,
		'',
	];

	if (!metrics.released && !metrics.noRelease) {
		return [...header, '> ❌ Release did not complete — check the step log.', ''];
	}

	const rows = [
		`- **Previous release:** ${metrics.previous ?? '—'}`,
		`- **Commits analyzed:** ${metrics.commits ?? 0}`,
	];

	if (metrics.released) {
		rows.push(
			`- **Decision:** 🎉 ${metrics.bump ?? 'new'} release · new version v${metrics.nextVersion}`,
		);

		return [...header, '## Summary', '', ...rows, '', `> ✅ Released v${metrics.nextVersion}.`, ''];
	}

	rows.push('- **Decision:** ⏭️ No release · no relevant changes');

	return [...header, '## Summary', '', ...rows, '', '> ℹ️ No new version published.', ''];
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

	writeStepSummary(buildSummary(parseReleaseLog(log)).join('\n'));
}

try {
	main();
} catch {
	process.exit(0);
}

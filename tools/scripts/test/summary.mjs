#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { inStepSummary, writeStepSummary } from '../util/github-summary.mjs';

// Vitest needs no help writing a job summary: in GitHub Actions it adds its own
// `github-actions` reporter, which appends a `## Vitest Test Report` block to
// `GITHUB_STEP_SUMMARY`. What it cannot do is tell two runs apart, and the `api` job runs it
// twice — unit, then integration — which stacks two blocks under the same heading.
//
// So each of those steps points `GITHUB_STEP_SUMMARY` at a file of its own and this script
// re-titles the block before appending it to the real summary. Everything else in the block
// — the stats line, the flaky-test list — is Vitest's and travels untouched.
const VITEST_HEADING = /^## Vitest Test Report$/mu;

function main() {
	if (!inStepSummary()) {
		return;
	}

	const title = process.argv[3] ?? 'Test Report';

	let report;

	try {
		report = readFileSync(process.argv[2] ?? '', 'utf8');
	} catch {
		// The redirected file is missing: the run died before the reporter got to write, or
		// Vitest stopped defaulting `outputPath` to `GITHUB_STEP_SUMMARY`. Say so instead of
		// leaving a gap that reads like the step never ran.
		writeStepSummary(`## ${title}\n\n> ⚠️ Vitest wrote no report — check the step log.\n`);

		return;
	}

	writeStepSummary(report.replace(VITEST_HEADING, `## ${title}`));
}

try {
	main();
} catch {
	process.exit(0);
}

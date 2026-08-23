#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { inStepSummary, writeStepSummary } from '../util/github-summary.mjs';

// Vitest writes its own summary block but cannot tell two runs apart, and the `api` job runs
// it twice. Each step redirects to its own file and this re-titles the block before appending.
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
		// The redirected file is missing: the run died before the reporter wrote. Say so, rather
		// than leaving a gap that reads like the step never ran.
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

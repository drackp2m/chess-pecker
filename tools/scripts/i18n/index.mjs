import { c, plural } from '../lint/lint-report.mjs';

import { buildFindings } from './checks.mjs';
import { collectUsages, readScopes } from './collect.mjs';
import { parseArgs } from './config.mjs';
import { applyFix } from './fix.mjs';
import { writeI18nSummary, writeSkippedSummary } from './github-summary.mjs';
import { printFindings, printWritten } from './report.mjs';

const options = parseArgs(process.argv.slice(2));
const scopes = readScopes(options);

if (!scopes.length) {
	console.log(`  ${c.dim}⊘ skipped — no scopes in ${options.i18nDir}${c.reset}`);
	writeSkippedSummary(options.i18nDir);
	process.exit(0);
}

const action = options.fix ? 'Fixing' : 'Checking';
const details = `${plural(scopes.length, 'scope')} · ${plural(options.langs.length, 'language')}`;

console.log(`${c.bold}${action} i18n...${c.reset} ${c.dim}(${details})${c.reset}`);

if (options.fix) {
	printWritten(applyFix({ ...options, scopes }));
}

// Re-read after writing: --fix reports whatever it could not fix by itself (an
// unregistered scope, a missing translation) instead of always claiming success.
const current = options.fix ? readScopes(options) : scopes;
const { usages, commented } = collectUsages(options.sourceDirs);
const findings = buildFindings({ ...options, scopes: current, usages, commented });

const exitCode = printFindings(findings, { ...options, scopes: current });

writeI18nSummary({ ...options, scopes: current, findings });

process.exit(exitCode);

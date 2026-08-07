import { buildFindings } from './checks.mjs';
import { collectUsages, readScopes } from './collect.mjs';
import { parseArgs } from './config.mjs';
import { applyFix } from './fix.mjs';
import { printFindings, printWritten } from './report.mjs';

const options = parseArgs(process.argv.slice(2));
const scopes = readScopes(options);

if (!scopes.length) {
	console.log(`ℹ️  No scopes found in ${options.i18nDir}`);
	process.exit(0);
}

if (options.fix) {
	printWritten(applyFix({ ...options, scopes }));
	process.exit(0);
}

const usages = collectUsages(options.sourceDirs);
const findings = buildFindings({ ...options, scopes, usages });

process.exit(printFindings(findings, { ...options, scopes }));

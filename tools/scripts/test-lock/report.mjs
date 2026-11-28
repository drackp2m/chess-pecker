import path from 'node:path';

import { c, plural, printProblems, printTally } from '../lint/lint-report.mjs';

import { shortHash } from './lock.mjs';

const ICONS = { added: `${c.green}+${c.reset}`, removed: `${c.red}-${c.reset}` };

const fullPath = (file) => path.resolve(file);

const toProblems = (findings) =>
	findings.map((item) => ({
		file: fullPath(item.file),
		severity: 'error',
		message: item.message,
		rule: item.type,
	}));

export function printHeader(action, files, lockFile) {
	const details = `${plural(files.length, 'file')} · ${lockFile}`;

	console.log(`${c.bold}${action} test lock...${c.reset} ${c.dim}(${details})${c.reset}`);
}

export function printCheck(findings, { locked }) {
	const problems = toProblems(findings);

	if (0 === problems.length) {
		console.log(`\n  ${c.green}✔ ${plural(locked, 'locked file')} intact.${c.reset}`);
	} else {
		console.log(`\n${c.bold}${c.cyan}━━ Problems ━━${c.reset}`);
		printProblems(problems);
		printTally(problems);
		console.log(
			`  ${c.dim}Restore them, or run \`pnpm test:lock --update\` to accept the change.${c.reset}`,
		);
	}

	return 0 === problems.length ? 0 : 1;
}

export function printChanges(changes) {
	if (0 === changes.length) {
		console.log(`\n  ${c.dim}✓ Lock already up to date${c.reset}`);

		return;
	}

	console.log(`\n  ${c.dim}Lock updated:${c.reset}`);

	for (const { kind, file, hash } of changes) {
		const icon = ICONS[kind] ?? `${c.yellow}~${c.reset}`;
		const digest = undefined === hash ? '' : `  ${c.dim}${shortHash(hash)}${c.reset}`;

		console.log(`    ${icon} ${fullPath(file)}${digest}`);
	}

	console.log(`\n  ${c.green}✔ ${plural(changes.length, 'change')} written${c.reset}`);
}

export function printList(entries) {
	if (0 === entries.length) {
		console.log(`\n  ${c.dim}⊘ nothing locked yet${c.reset}`);

		return;
	}

	for (const { file, hash, status } of entries) {
		const icon = 'ok' === status ? `${c.green}✔${c.reset}` : `${c.red}✖${c.reset}`;

		console.log(`  ${icon} ${c.dim}${shortHash(hash)}${c.reset}  ${file}`);
	}

	console.log(`\n  ${plural(entries.length, 'locked file')}`);
}

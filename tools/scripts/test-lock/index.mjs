#!/usr/bin/env node
import { existsSync } from 'node:fs';

import { c } from '../lint/lint-report.mjs';
import { selectFromList } from '../util/select-list.mjs';

import { candidates, parseArgs } from './config.mjs';
import { writeTestLockSummary } from './github-summary.mjs';
import { checkLock, hashAll, hashOf, lockedFiles, readLock, writeLock } from './lock.mjs';
import { printChanges, printCheck, printHeader, printList } from './report.mjs';

const options = parseArgs(process.argv.slice(2));
const lock = readLock(options.lockFile);

if (lock.broken) {
	console.error(`${c.red}✖ ${options.lockFile} is not valid JSON.${c.reset}`);
	process.exit(1);
}

function runCheck() {
	const files = lockedFiles(lock, options.filters);
	const unlocked = candidates(options).filter((file) => undefined === lock.files[file]);

	printHeader('Checking', files, options.lockFile);

	if (0 === files.length && !lock.exists) {
		const hint = 'run `pnpm test:lock:select` to lock files';

		console.log(`\n  ${c.dim}⊘ skipped — ${hint}${c.reset}`);

		return 0;
	}

	const findings = checkLock(lock, files, unlocked);
	const scope = options.filters.join(', ');

	writeTestLockSummary({ findings, locked: files.length, strict: options.strict, scope });

	return printCheck(findings, { strict: options.strict, locked: files.length });
}

function changesOf(previous, next) {
	const files = [...new Set([...Object.keys(previous), ...Object.keys(next)])].sort();

	return files
		.map((file) => {
			const before = previous[file];
			const after = next[file];

			if (before === after) {
				return null;
			}

			const kind = undefined === before ? 'added' : undefined === after ? 'removed' : 'rehashed';

			return { kind, file, hash: after };
		})
		.filter(Boolean);
}

function runUpdate() {
	const targets = lockedFiles(lock, options.filters).filter(existsSync);
	const missing = lockedFiles(lock, options.filters).filter((file) => !existsSync(file));

	printHeader('Updating', targets, options.lockFile);

	const next = { ...lock.files };

	for (const file of targets) {
		next[file] = hashOf(file);
	}

	for (const file of missing) {
		delete next[file];
	}

	printChanges(changesOf(lock.files, writeLock(options.lockFile, next)));

	return 0;
}

function runList() {
	const files = lockedFiles(lock, options.filters);

	printHeader('Listing', files, options.lockFile);
	printList(
		files.map((file) => ({
			file,
			hash: lock.files[file],
			status: existsSync(file) && hashOf(file) === lock.files[file] ? 'ok' : 'changed',
		})),
	);

	return 0;
}

async function runSelect() {
	if (!process.stdin.isTTY) {
		console.error(`${c.red}✖ --select needs an interactive terminal.${c.reset}`);

		return 1;
	}

	const files = candidates(options);

	printHeader('Selecting', files, options.lockFile);

	const chosen = await selectFromList(files, Object.keys(lock.files));

	if (null === chosen) {
		console.log(`\n  ${c.dim}⊘ cancelled — the lock file is untouched${c.reset}`);

		return 0;
	}

	const kept = Object.fromEntries(
		Object.entries(lock.files).filter(([file]) => !files.includes(file)),
	);

	printChanges(changesOf(lock.files, writeLock(options.lockFile, { ...kept, ...hashAll(chosen) })));

	return 0;
}

const RUNNERS = { check: runCheck, update: runUpdate, list: runList, select: runSelect };

process.exit(await RUNNERS[options.mode]());

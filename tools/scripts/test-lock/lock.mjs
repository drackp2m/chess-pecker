import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { matchesFilters } from './config.mjs';

const VERSION = 1;
const ALGORITHM = 'sha256';

export const hashOf = (file) =>
	createHash(ALGORITHM).update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');

export const shortHash = (hash) => hash.slice(0, 12);

export function readLock(lockFile) {
	if (!existsSync(lockFile)) {
		return { files: {}, exists: false };
	}

	try {
		const parsed = JSON.parse(readFileSync(lockFile, 'utf8'));

		return { files: parsed?.files ?? {}, exists: true };
	} catch {
		return { files: {}, exists: true, broken: true };
	}
}

export function writeLock(lockFile, files) {
	const sorted = Object.fromEntries(
		Object.entries(files).sort(([left], [right]) => left.localeCompare(right)),
	);
	const content = { version: VERSION, algorithm: ALGORITHM, files: sorted };

	writeFileSync(lockFile, `${JSON.stringify(content, null, 2)}\n`);

	return sorted;
}

export const hashAll = (files) => Object.fromEntries(files.map((file) => [file, hashOf(file)]));

export const lockedFiles = (lock, filters) =>
	Object.keys(lock.files)
		.filter((file) => matchesFilters(file, filters))
		.sort((left, right) => left.localeCompare(right));

function checkOne(file, expected) {
	if (!existsSync(file)) {
		return { file, type: 'deleted', message: 'Locked test file no longer exists.' };
	}

	const found = hashOf(file);

	if (found === expected) {
		return null;
	}

	return {
		file,
		type: 'modified',
		expected,
		found,
		message: `Content changed — locked ${shortHash(expected)}, found ${shortHash(found)}.`,
	};
}

export function checkLock(lock, files, unlocked) {
	const problems = files.map((file) => checkOne(file, lock.files[file])).filter(Boolean);
	const notes = unlocked.map((file) => ({
		file,
		type: 'unlocked',
		message: 'Test file is not locked — run `pnpm test:lock --select` to include it.',
	}));

	return [...problems, ...notes];
}

export const severityOf = (type, strict) =>
	'unlocked' === type ? (strict ? 'error' : 'info') : 'error';

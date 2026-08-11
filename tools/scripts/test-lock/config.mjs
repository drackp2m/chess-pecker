import path from 'node:path';

import { repoFiles } from '../lint/walk-files.mjs';

export const DEFAULTS = {
	lockFile: path.join('tools', 'test-lock.json'),
	suffixes: ['.spec.ts', '.test.ts'],
};

export const toPosix = (file) => file.split(path.sep).join('/');

const MODES = [
	['--select', 'select'],
	['--update', 'update'],
	['--list', 'list'],
];

const modeOf = (argv) => MODES.find(([flag]) => argv.includes(flag))?.[1] ?? 'check';

function readValue(argv, flag) {
	const index = argv.indexOf(flag);

	return -1 === index ? null : (argv[index + 1] ?? null);
}

function readFilters(argv) {
	const consumed = new Set([readValue(argv, '--lock')]);

	return argv
		.filter((arg) => !arg.startsWith('--') && !consumed.has(arg))
		.map((arg) => toPosix(arg).replace(/\/+$/, ''));
}

export function parseArgs(argv) {
	const lock = readValue(argv, '--lock');

	return {
		...DEFAULTS,
		...(lock ? { lockFile: lock } : {}),
		mode: modeOf(argv),
		strict: argv.includes('--strict'),
		filters: readFilters(argv),
	};
}

export const matchesFilters = (file, filters) =>
	0 === filters.length ||
	filters.some((filter) => file === filter || file.startsWith(`${filter}/`));

export function candidates({ suffixes, filters }) {
	return repoFiles()
		.map(toPosix)
		.filter((file) => suffixes.some((suffix) => file.endsWith(suffix)))
		.filter((file) => matchesFilters(file, filters))
		.sort((left, right) => left.localeCompare(right));
}

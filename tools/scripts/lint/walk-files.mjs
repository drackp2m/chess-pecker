// Walks the repo tree for the whole-repo Prettier target list. ESLint and
// Stylelint get "." / a glob and filter via their own ignore config; Prettier
// processes files one by one, so it needs a concrete list up front.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const rel = (absolute) => path.relative(cwd, absolute) || absolute;
// Normalize to forward slashes so the relative paths compare against the
// forward-slash patterns in .prettierignore regardless of OS separator.
const relPosix = (absolute) => rel(absolute).split(path.sep).join('/');

// Directories pruned before descending, instead of walking in and letting
// Prettier's per-file ignore check discard every file — descending into e.g.
// .pnpm-store means enumerating ~50k files just to skip them (the whole-repo
// slowness). Derived from the root-anchored ("/dir") entries in .prettierignore
// so it stays a single source of truth, plus .git, which .prettierignore doesn't
// list. Non-anchored/glob patterns (e.g. "Dockerfile") aren't pruned here: those
// files are still walked and skipped per-file by Prettier — correct, just not as
// fast — so nothing is ever missed, only a slow dir would need a "/dir" entry.
function prunedDirs() {
	const dirs = new Set(['.git']);

	if (existsSync('.prettierignore')) {
		for (const raw of readFileSync('.prettierignore', 'utf8').split('\n')) {
			const line = raw.trim();

			// Skip blanks, comments, and non-anchored patterns (only "/dir" entries
			// name a concrete directory we can prune by path).
			if ('' === line || line.startsWith('#') || !line.startsWith('/')) {
				continue;
			}

			dirs.add(line.slice(1).replace(/\/+$/, ''));
		}
	}

	return dirs;
}

const SKIP_DIRS = prunedDirs();

export function repoFiles() {
	const files = [];

	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(relPosix(full))) {
					walk(full);
				}
			} else if (entry.isFile()) {
				files.push(rel(full));
			}
		}
	};

	walk(cwd);

	return files;
}

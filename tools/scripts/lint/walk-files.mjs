// Walks the repo tree for the whole-repo Prettier target list, which the other two tools do
// not need: they filter through their own ignore config.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const rel = (absolute) => path.relative(cwd, absolute) || absolute;
// Normalize to forward slashes so the relative paths compare against the
// forward-slash patterns in .prettierignore regardless of OS separator.
const relPosix = (absolute) => rel(absolute).split(path.sep).join('/');

// Pruned before descending, since walking .pnpm-store means enumerating ~50k files just to
// skip them. Derived from .prettierignore's root-anchored entries, plus .git.
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

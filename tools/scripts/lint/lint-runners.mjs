// File discovery + the ESLint/Stylelint/Prettier runners for the lint script.
// Each runner returns { fixed, remaining } (or { skipped: true, … } when it has
// no matching files); the entry point decides what to lint and how to show it.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ESLint } from 'eslint';
import prettier from 'prettier';
import stylelint from 'stylelint';

const cwd = process.cwd();
const rel = (absolute) => path.relative(cwd, absolute) || absolute;
const abs = (file) => path.resolve(cwd, file);

const LOCK_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']);
const ignorePath = existsSync('.prettierignore') ? '.prettierignore' : undefined;

export const ESLINT_EXT = ['.ts', '.html', '.js', '.mjs'];
export const STYLELINT_EXT = ['.css', '.scss'];
export const withExt = (files, exts) =>
	files.filter((file) => exts.some((ext) => file.endsWith(ext)));

export async function runEslint(targets, fix, verbose) {
	if (0 === targets.length) {
		return { skipped: true, fixed: [], remaining: [] };
	}

	const fixed = [];
	let results;

	if (fix) {
		// Only with --verbose: a pre-pass without fixing counts the auto-fixable
		// problems per file (= corrections the fix pass will apply), since ESLint
		// doesn't report applied-fix counts. It's the expensive second pass.
		const fixableByFile = new Map();

		if (verbose) {
			for (const result of await new ESLint({ warnIgnored: false }).lintFiles(targets)) {
				const count = result.messages.filter((message) => undefined !== message.fix).length;

				if (0 !== count) {
					fixableByFile.set(result.filePath, count);
				}
			}
		}

		results = await new ESLint({ fix: true, warnIgnored: false }).lintFiles(targets);
		await ESLint.outputFixes(results);

		for (const result of results) {
			if (undefined !== result.output) {
				const count = fixableByFile.get(result.filePath) ?? null;
				fixed.push({ file: rel(result.filePath), count });
			}
		}
	} else {
		results = await new ESLint({ warnIgnored: false }).lintFiles(targets);
	}

	const remaining = [];

	for (const result of results) {
		for (const message of result.messages) {
			remaining.push({
				file: abs(result.filePath),
				line: message.line,
				col: message.column,
				severity: 2 === message.severity ? 'error' : 'warning',
				message: message.message,
				rule: message.ruleId ?? null,
			});
		}
	}

	return { fixed, remaining };
}

export async function runStylelint(files, fix, verbose) {
	if (0 === files.length) {
		return { skipped: true, fixed: [], remaining: [] };
	}

	const fixed = [];
	let results;

	if (!fix) {
		({ results } = await stylelint.lint({ files }));
	} else if (verbose) {
		// Before/after diff gives the per-file correction count (cheap for Stylelint).
		const before = new Map();

		for (const result of (await stylelint.lint({ files })).results) {
			before.set(result.source, result.warnings.length);
		}

		({ results } = await stylelint.lint({ files, fix: true }));

		for (const result of results) {
			const corrected = (before.get(result.source) ?? 0) - result.warnings.length;

			if (0 < corrected) {
				fixed.push({ file: rel(result.source), count: corrected });
			}
		}
	} else {
		// Single pass: fix each file in memory, write only when it changed (no counts).
		results = [];

		for (const file of files) {
			const code = await readFile(file, 'utf8').catch(() => null);

			if (null === code) {
				continue;
			}

			const result = await stylelint.lint({ code, codeFilename: file, fix: true });
			results.push(...result.results);

			if (undefined !== result.code && result.code !== code) {
				await writeFile(file, result.code);
				fixed.push({ file: rel(abs(file)), count: null });
			}
		}
	}

	const remaining = [];

	for (const result of results) {
		for (const warning of result.warnings) {
			const suffix = ` (${warning.rule})`;
			const message = warning.text.endsWith(suffix)
				? warning.text.slice(0, -suffix.length)
				: warning.text;
			remaining.push({
				file: abs(result.source),
				line: warning.line,
				col: warning.column,
				severity: warning.severity,
				message,
				rule: warning.rule,
			});
		}
	}

	return { fixed, remaining };
}

export async function runPrettier(files, fix) {
	const fixed = [];
	const remaining = [];
	let processed = 0;

	for (const file of files) {
		if (LOCK_FILES.has(path.basename(file))) {
			continue;
		}

		const info = await prettier.getFileInfo(file, { ignorePath });

		if (info.ignored || null === info.inferredParser) {
			continue;
		}

		processed++;

		let content;

		try {
			content = await readFile(file, 'utf8');
		} catch {
			continue;
		}

		try {
			// editorconfig: true is required for the programmatic API to honor
			// .editorconfig (indent_style=tab, …); the CLI reads it by default.
			const config = await prettier.resolveConfig(file, { editorconfig: true });
			const options = { ...config, filepath: file };

			if (fix) {
				const formatted = await prettier.format(content, options);

				if (formatted !== content) {
					await writeFile(file, formatted);
					fixed.push({ file: rel(abs(file)), count: null });
				}
			} else if (!(await prettier.check(content, options))) {
				// A gate like `prettier --check`: unformatted files fail the run.
				remaining.push({
					file: abs(file),
					line: undefined,
					col: undefined,
					severity: 'error',
					message: 'needs formatting (run lint:fix)',
					rule: 'prettier',
				});
			}
		} catch (error) {
			const location = error.loc?.start;
			remaining.push({
				file: abs(file),
				line: location?.line,
				col: location?.column,
				severity: 'error',
				message: String(error.message).split('\n')[0],
				rule: null,
			});
		}
	}

	if (0 === processed) {
		return { skipped: true, fixed: [], remaining: [] };
	}

	return { fixed, remaining };
}

// Passed files that no tool would process — not an ESLint/Stylelint extension
// and not something Prettier can parse (deliberately ignored files don't count).
// Surfaced so a new lint-staged glob entry can't slip through unlinted.
export async function findUncovered(files) {
	const uncovered = [];

	for (const file of files) {
		const ext = path.extname(file);

		if (ESLINT_EXT.includes(ext) || STYLELINT_EXT.includes(ext)) {
			continue;
		}

		const info = await prettier.getFileInfo(file, { ignorePath });

		if (info.ignored || null !== info.inferredParser) {
			continue;
		}

		uncovered.push(rel(abs(file)));
	}

	return uncovered;
}

#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { inStepSummary, writeStepSummary } from '../util/github-summary.mjs';

function parsePnpmLog(log) {
	const supply = log.match(
		/Lockfile (passes|fails) supply-chain policies \((\d+) entries in ([\d.]+)s\)/,
	);
	const progress = [
		...log.matchAll(/resolved (\d+), reused (\d+), downloaded (\d+), added (\d+)/g),
	].at(-1);
	const done = log.match(/Done in ([\d.]+)s using pnpm v([\d.]+)/);

	return {
		lockfileUpToDate: /Lockfile is up to date/.test(log),
		supplyChain:
			null === supply
				? null
				: { ok: 'passes' === supply[1], entries: Number(supply[2]), seconds: Number(supply[3]) },
		progress:
			undefined === progress
				? null
				: {
						reused: Number(progress[2]),
						downloaded: Number(progress[3]),
						added: Number(progress[4]),
					},
		seconds: null === done ? null : Number(done[1]),
		pnpmVersion: null === done ? null : done[2],
	};
}

function humanBytes(bytes) {
	if (null === bytes) {
		return 'n/a';
	}

	const units = ['B', 'KB', 'MB', 'GB'];
	let value = bytes;
	let unit = 0;

	while (1024 <= value && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}

	return `${value.toFixed(2 > unit ? 0 : 1)} ${units[unit]}`;
}

function dirSize(path) {
	try {
		return Number(execSync(`du -sb ${path}`, { encoding: 'utf8' }).split('\t')[0]);
	} catch {
		return null;
	}
}

function depCounts() {
	try {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

		return {
			prod: Object.keys(pkg.dependencies ?? {}).length,
			dev: Object.keys(pkg.devDependencies ?? {}).length,
		};
	} catch {
		return { prod: 0, dev: 0 };
	}
}

function cacheLine(progress) {
	if (null === progress) {
		return null;
	}

	const total = progress.reused + progress.downloaded;
	const reused = 0 === total ? null : Math.round((progress.reused / total) * 100);
	const rate = null === reused ? '' : `♻️ ${reused}% reused · `;

	return `**Packages:** ${progress.added} added · ${rate}reused ${progress.reused} · downloaded ${progress.downloaded}`;
}

function buildSummary(metrics) {
	const header = [
		'# pnpm Install Report',
		'',
		`_pnpm ${metrics.pnpmVersion ?? 'unknown'} · Node ${process.versions.node}_`,
		'',
	];

	if (null === metrics.seconds) {
		return [...header, '> ❌ Install did not complete — check the step log.', ''];
	}

	const deps = depCounts();
	const rows = ['- **Lockfile:** ' + (metrics.lockfileUpToDate ? '✅ Up to date' : 'Updated')];

	if (null !== metrics.supplyChain) {
		const check = metrics.supplyChain.ok ? '✓' : '✗';
		rows.push(
			`- **Supply-chain:** ${check} ${metrics.supplyChain.entries} entries checked in ${metrics.supplyChain.seconds}s`,
		);
	}

	const cache = cacheLine(metrics.progress);

	if (null !== cache) {
		rows.push(`- ${cache}`);
	}

	rows.push(
		`- **Dependencies:** ${deps.prod} prod · ${deps.dev} dev`,
		`- **node_modules:** 📦 ${humanBytes(dirSize('node_modules'))}`,
		`- **Duration:** ⏱️ ${metrics.seconds}s`,
	);

	return [...header, '## Summary', '', ...rows, '', '> ✅ Frozen install completed.', ''];
}

function main() {
	if (!inStepSummary()) {
		return;
	}

	let log;

	try {
		log = readFileSync(process.argv[2] ?? '', 'utf8');
	} catch {
		log = '';
	}

	writeStepSummary(buildSummary(parsePnpmLog(log)).join('\n'));
}

try {
	main();
} catch {
	process.exit(0);
}

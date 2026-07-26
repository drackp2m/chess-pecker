import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── ANSI helpers ─────────────────────────────────────────────────────
const R = '\x1b[0m';
const B = '\x1b[1m';
const C = '\x1b[94m';
const G = '\x1b[92m';
const Y = '\x1b[93m';
const RD = '\x1b[91m';

const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
const stripAnsi = (s) => s.replace(ANSI_PATTERN, '');

const visWidth = (s) => {
	const clean = stripAnsi(s);
	let w = 0;

	for (const c of clean) {
		const cp = c.codePointAt(0);
		w += 0xffff < cp || (0x2600 <= cp && 0x27bf >= cp) || 0x1f300 <= cp ? 2 : 1;
	}

	return w;
};

const pad = (s, w) => s + ' '.repeat(Math.max(0, w - visWidth(s)));

const diffType = (exp, found) => {
	const a = exp.split('.').map(Number),
		b = found.split('.').map(Number);

	for (let i = 0; 3 > i; i++) {
		if (a[i] !== b[i]) {
			return 0 === i ? 'major' : 1 === i ? 'minor' : 'patch';
		}
	}

	return 'same';
};

const colorDiff = (exp, found, type) => {
	const a = exp.split('.'),
		b = found.split('.');
	let i = 0;

	while (3 > i && a[i] === b[i]) {
		i++;
	}

	if (3 === i) {
		return found;
	}

	const prefix = b.slice(0, i).join('.'),
		suffix = b.slice(i).join('.');
	const color = 'major' === type ? RD : 'minor' === type ? Y : G;

	return 0 === i ? `${B}${color}${found}${R}` : `${prefix}.${B}${color}${suffix}${R}`;
};

// ─── 0. Parse args ────────────────────────────────────────────────────
const fixMode = process.argv.includes('--fix');

// ─── 1. Read package.json version ─────────────────────────────────────
const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

const pm = pkg.packageManager;

if (!pm?.startsWith('pnpm@')) {
	console.error('❌ "packageManager": "pnpm@X.Y.Z" not found in package.json');
	process.exit(1);
}
const pkgVer = pm.replace('pnpm@', '');

console.log(`🔍 ${fixMode ? 'Fixing' : 'Checking'} pnpm version sync...\n`);
console.log(`ℹ️  Found version ${B}${C}${pkgVer}${R} on package.json\n`);

// ─── 2. Scan workflows ────────────────────────────────────────────────
const wDir = join(process.cwd(), '.github', 'workflows');

if (!existsSync(wDir)) {
	console.log('ℹ️  No workflows to check.');
	process.exit(0);
}

const files = readdirSync(wDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

if (!files.length) {
	console.log('ℹ️  No workflow files to check.');
	process.exit(0);
}

const reserved = [
	'steps',
	'runs-on',
	'needs',
	'if',
	'env',
	'defaults',
	'permissions',
	'strategy',
	'outputs',
	'timeout-minutes',
	'concurrency',
	'services',
	'container',
];

const mismatches = new Map();

for (const file of files) {
	const filePath = join(wDir, file);
	const content = readFileSync(filePath, 'utf8');
	const lines = content.split(/\r?\n/);
	const bad = [];
	let job = null,
		inStep = false,
		inWith = false,
		jIndent = -1;

	for (const line of lines) {
		const t = line.trim();

		// Fix: blank lines or comments while inStep → reset to avoid false positives
		if (!t || t.startsWith('#')) {
			if (inStep) {
				inStep = false;
				inWith = false;
			}

			continue;
		}

		const ind = line.length - line.trimStart().length;

		if (/^jobs:/.test(t)) {
			jIndent = ind;

			continue;
		}

		if (-1 !== jIndent && ind === jIndent + 2 && !t.startsWith('-')) {
			const k = t.split(':')[0];

			if (k && !reserved.includes(k)) {
				job = k;
			}
		}

		if (/uses:\s*pnpm\/action-setup@/.test(t)) {
			inStep = true;
			inWith = false;

			continue;
		}

		if (inStep) {
			// Fix: accept "with:" as an intermediate line before "version:"
			if (t.startsWith('with:')) {
				inWith = true;

				continue;
			}

			if (t.startsWith('version:') && inWith) {
				const m = t.match(/^version:\s*["']?([^\s#"']+)["']?/);

				if (m) {
					const v = m[1].trim();

					if (v !== pkgVer) {
						bad.push({ job: job || 'unnamed', v, d: diffType(pkgVer, v) });
					}
				}
				inStep = false;
				inWith = false;

				continue;
			}

			// Any other step boundary resets the state
			if (t.startsWith('- name:') || t.startsWith('uses:')) {
				inStep = false;
				inWith = false;
			}
		}
	}

	if (bad.length) {
		mismatches.set(file, { bad, content });
	}
}

// ─── 3. Fix ───────────────────────────────────────────────────────────
if (fixMode && mismatches.size) {
	for (const [file, { bad, content }] of mismatches) {
		let fixed = content;

		for (const { v } of bad) {
			fixed = fixed.replace(
				new RegExp(`(version:\\s*["']?)${v.replace(/\./g, '\\.')}(["']?)`, 'g'),
				`$1${pkgVer}$2`,
			);
		}

		writeFileSync(join(wDir, file), fixed, 'utf8');
		console.log(`✏️  Fixed ${B}${C}${file}${R}`);
	}

	console.log(`\n✅ All pnpm versions updated to ${B}${G}${pkgVer}${R}.`);
	process.exit(0);
}

// ─── 4. Report ────────────────────────────────────────────────────────
if (mismatches.size) {
	for (const [file, { bad }] of mismatches) {
		const wJob = Math.max(...bad.map((m) => visWidth(m.job)), visWidth('Job'));
		const wVer = Math.max(
			...bad.map((m) => visWidth(colorDiff(pkgVer, m.v, m.d))),
			visWidth('Version'),
		);

		const top = `┌${'─'.repeat(wJob + 2)}┬${'─'.repeat(wVer + 2)}┐`;
		const mid = `├${'─'.repeat(wJob + 2)}┼${'─'.repeat(wVer + 2)}┤`;
		const bot = `└${'─'.repeat(wJob + 2)}┴${'─'.repeat(wVer + 2)}┘`;

		console.error(`📄 ${file}`);
		console.error(top);
		console.error(`│ ${pad(`${B}${C}Job${R}`, wJob)} │ ${pad(`${B}${C}Version${R}`, wVer)} │`);
		console.error(mid);

		for (const { job, v, d } of bad) {
			console.error(`│ ${pad(job, wJob)} │ ${pad(colorDiff(pkgVer, v, d), wVer)} │`);
		}

		console.error(bot);
		console.error('');
	}

	console.error('⛔ pnpm versions are out of sync. Please align them before committing.');
	console.error(`ℹ️  Run with --fix to update them automatically.`);
	process.exit(1);
}

console.log(`✅ All pnpm versions are in sync.`);

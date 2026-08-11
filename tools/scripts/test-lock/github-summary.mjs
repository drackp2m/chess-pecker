import { plural } from '../lint/lint-report.mjs';
import { inStepSummary, writeStepSummary } from '../util/github-summary.mjs';

import { severityOf } from './lock.mjs';

const ICONS = { modified: '❌', deleted: '❌', unlocked: 'ℹ️' };

const verdictOf = (problems, locked) =>
	0 === problems.length
		? `> ✅ ${plural(locked, 'locked test file')} intact.`
		: `> ❌ ${plural(problems.length, 'locked test file')} changed since the lock was written.`;

function findingRows(findings) {
	return findings.map(({ file, type, message }) => `| ${ICONS[type]} | \`${file}\` | ${message} |`);
}

function findingTable(findings) {
	if (0 === findings.length) {
		return [];
	}

	return ['', '| | file | detail |', '| :---: | :--- | :--- |', ...findingRows(findings)];
}

export function writeTestLockSummary({ findings, locked, strict, scope }) {
	if (!inStepSummary()) {
		return;
	}

	const problems = findings.filter(({ type }) => 'info' !== severityOf(type, strict));
	const notes = findings.length - problems.length;
	const title = scope ? `Test Lock — \`${scope}\`` : 'Test Lock';
	const tail = 0 === notes ? [] : ['', `ℹ️ ${plural(notes, 'test file')} not locked.`];

	writeStepSummary(
		[`## ${title}`, '', verdictOf(problems, locked), ...findingTable(problems), ...tail].join('\n'),
	);
}

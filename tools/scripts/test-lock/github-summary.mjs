import { plural } from '../lint/lint-report.mjs';
import { inStepSummary, writeStepSummary } from '../util/github-summary.mjs';

const ICONS = { modified: '❌', deleted: '❌' };

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

export function writeTestLockSummary({ findings, locked, scope }) {
	if (!inStepSummary()) {
		return;
	}

	const title = scope ? `Test Lock — \`${scope}\`` : 'Test Lock';

	writeStepSummary(
		[`## ${title}`, '', verdictOf(findings, locked), ...findingTable(findings)].join('\n'),
	);
}

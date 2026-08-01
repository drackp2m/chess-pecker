import { plural } from '../lint/lint-report.mjs';
import { writeStepSummary } from '../util/github-summary.mjs';

function statusOf(row) {
	if (row.skipped) {
		return '⊘ Skipped — no matching files';
	}

	const problems = row.errors + row.warnings;

	if (0 === problems) {
		return '✅ No problems';
	}

	const emoji = 0 !== row.errors ? '❌' : '⚠️';
	const parts = [
		plural(problems, 'Problem'),
		plural(row.errors, 'Error'),
		plural(row.warnings, 'Warning'),
	];

	return `${emoji} ${parts.join(' · ')}`;
}

function verdictOf({ errors, warnings, maxWarnings }) {
	if (0 !== errors) {
		return '> ❌ Lint failed — errors must be fixed.';
	}

	if (null !== maxWarnings && warnings > maxWarnings) {
		const verb = 1 === warnings ? 'exceeds' : 'exceed';

		return `> ⚠️ ${plural(warnings, 'warning')} ${verb} the \`--max-warnings ${maxWarnings}\` limit.`;
	}

	return '> ✅ All checks passed.';
}

export function writeLintSummary({ rows, errors, warnings, maxWarnings, details }) {
	const lines = [
		'## Custom Lint Report',
		'',
		`_${details}_`,
		'',
		'### Summary',
		'',
		...rows.map((row) => `- **${row.name}:** ${statusOf(row)}`),
		'',
		verdictOf({ errors, warnings, maxWarnings }),
		'',
	];

	writeStepSummary(lines.join('\n'));
}

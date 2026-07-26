const stylelint = require('stylelint');

const ruleName = 'angular-custom/ng-deep-requires-host';

const messages = stylelint.utils.ruleMessages(ruleName, {
	expected:
		'::ng-deep must be scoped with :host to avoid leaking styles globally (use `:host ::ng-deep`)',
});

const meta = { fixable: true };

/** Walks up the SCSS nesting looking for an ancestor rule already scoped by `:host`. */
function ancestorHasHost(rule) {
	let parent = rule.parent;

	while (parent && 'root' !== parent.type) {
		if ('rule' === parent.type && parent.selector.includes(':host')) {
			return true;
		}

		parent = parent.parent;
	}

	return false;
}

/** Splits a selector list on top-level commas, ignoring commas inside `()` / `[]`. */
function splitTopLevel(selector) {
	const parts = [];
	let depth = 0;
	let current = '';

	for (const char of selector) {
		if ('(' === char || '[' === char) {
			depth++;
		} else if (')' === char || ']' === char) {
			depth--;
		}

		if (',' === char && 0 === depth) {
			parts.push(current);
			current = '';
		} else {
			current += char;
		}
	}

	parts.push(current);

	return parts;
}

function isViolatingPart(part) {
	return part.includes('::ng-deep') && !part.includes(':host');
}

function scopePart(part) {
	const leading = /^\s*/.exec(part)?.[0] ?? '';

	return `${leading}:host ${part.slice(leading.length)}`;
}

const ruleFunction = (primary) => {
	return (root, result) => {
		const validOptions = stylelint.utils.validateOptions(result, ruleName, { actual: primary });

		if (!validOptions) {
			return;
		}

		root.walkRules((rule) => {
			if (!rule.selector.includes('::ng-deep') || ancestorHasHost(rule)) {
				return;
			}

			const parts = splitTopLevel(rule.selector);

			if (!parts.some(isViolatingPart)) {
				return;
			}

			stylelint.utils.report({
				result,
				ruleName,
				node: rule,
				message: messages.expected,
				word: '::ng-deep',
				fix: () => {
					rule.selector = parts
						.map((part) => (isViolatingPart(part) ? scopePart(part) : part))
						.join(',');
				},
			});
		});
	};
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = meta;

module.exports = stylelint.createPlugin(ruleName, ruleFunction);

const { getComponentMetadataKeys } = require('../lib/component-metadata-keys.js');

const DEFAULT_ORDER = [
	'selector',
	'inputs',
	'outputs',
	'providers',
	'exportAs',
	'queries',
	'host',
	'jit',
	'standalone',
	'hostDirectives',
	'changeDetection',
	'viewProviders',
	'templateUrl',
	'template',
	'styleUrl',
	'styleUrls',
	'styles',
	'animations',
	'encapsulation',
	'preserveWhitespaces',
	'imports',
	'schemas',
];

const orderIndexIn = (order, name) => {
	const index = order.indexOf(name);

	return -1 === index ? order.length : index;
};

// Rewrites the whole property list at once, so a single fix settles the order.
const buildFix = (context, order, props) => (fixer) => {
	const sourceCode = context.sourceCode;
	const newText = [...props]
		.sort((a, b) => orderIndexIn(order, a.key.name) - orderIndexIn(order, b.key.name))
		.map((p) => sourceCode.getText(p))
		.join(',\n  ');

	return fixer.replaceTextRange([props[0].range[0], props[props.length - 1].range[1]], newText);
};

function reportMisplaced(context, order, props) {
	const fix = buildFix(context, order, props);

	for (let i = 0; i < props.length; i++) {
		const prop = props[i];
		const index = orderIndexIn(order, prop.key.name);
		const before = props.slice(0, i).find((p) => orderIndexIn(order, p.key.name) > index);

		if (before) {
			context.report({
				node: prop,
				message: '`{{prop}}` property should occur before `{{before}}`',
				data: { prop: prop.key.name, before: before.key.name },
				fix,
			});
		}
	}
}

module.exports = {
	meta: {
		type: 'layout',
		fixable: 'code',
		schema: [
			{
				type: 'array',
				items: { enum: getComponentMetadataKeys() },
				uniqueItems: true,
			},
		],
	},
	create(context) {
		const order = context.options[0] ?? DEFAULT_ORDER;

		return {
			Decorator(node) {
				if ('Component' !== node.expression.callee?.name) {
					return;
				}
				const arg = node.expression.arguments[0];

				if (!arg || 'ObjectExpression' !== arg.type) {
					return;
				}

				reportMisplaced(context, order, arg.properties);
			},
		};
	},
};

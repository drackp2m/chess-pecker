const { getComponentMetadataKeys } = require('../lib/component-metadata-keys.js');

function keyName(prop) {
	if ('Property' !== prop.type) {
		return null;
	}

	if ('Identifier' === prop.key.type) {
		return prop.key.name;
	}

	if ('Literal' === prop.key.type && 'string' === typeof prop.key.value) {
		return prop.key.value;
	}

	return null;
}

module.exports = {
	meta: {
		type: 'problem',
		schema: [
			{
				type: 'array',
				items: { enum: getComponentMetadataKeys() },
				uniqueItems: true,
				minItems: 1,
			},
		],
		messages: {
			forbidden: 'The `{{prop}}` property is not allowed in this `@Component` decorator.',
		},
	},
	create(context) {
		const forbidden = new Set(context.options[0] ?? []);

		if (0 === forbidden.size) {
			return {};
		}

		return {
			Decorator(node) {
				if ('Component' !== node.expression.callee?.name) {
					return;
				}

				const arg = node.expression.arguments[0];

				if (!arg || 'ObjectExpression' !== arg.type) {
					return;
				}

				for (const prop of arg.properties) {
					const name = keyName(prop);

					if (null !== name && forbidden.has(name)) {
						context.report({
							node: prop,
							messageId: 'forbidden',
							data: { prop: name },
						});
					}
				}
			},
		};
	},
};

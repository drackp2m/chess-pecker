module.exports = {
	meta: {
		type: 'problem',
		fixable: 'code',
		schema: [],
	},
	create(context) {
		return {
			Decorator(node) {
				if ('Component' !== node.expression.callee?.name) {
					return;
				}

				const classNode = node.parent;

				if (
					'ClassDeclaration' !== classNode?.type ||
					true !== classNode.id?.name.endsWith('Page')
				) {
					return;
				}

				const arg = node.expression.arguments[0];

				if (!arg || 'ObjectExpression' !== arg.type) {
					return;
				}

				const selectorProp = arg.properties.find(
					(prop) => 'Property' === prop.type && 'selector' === prop.key.name,
				);

				if (!selectorProp) {
					return;
				}

				context.report({
					node: selectorProp,
					message:
						'`{{name}}` is a Page component and must not declare a `selector`; without one Angular hosts it in `<ng-component>`, which the layout CSS relies on.',
					data: { name: classNode.id.name },
					fix(fixer) {
						const props = arg.properties;
						const index = props.indexOf(selectorProp);

						if (1 === props.length) {
							return fixer.remove(selectorProp);
						}

						if (index === props.length - 1) {
							return fixer.removeRange([props[index - 1].range[1], selectorProp.range[1]]);
						}

						return fixer.removeRange([selectorProp.range[0], props[index + 1].range[0]]);
					},
				});
			},
		};
	},
};

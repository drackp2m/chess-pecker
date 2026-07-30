const MESSAGE =
	'`{{name}}` is a Page component and must not declare a `selector`; without one Angular hosts it in `<ng-component>`, which the layout CSS relies on.';

// The `selector` entry of a `@Component({ … })` on a class named `…Page`, if there is one.
function findPageSelector(node) {
	const classNode = node.parent;

	if ('ClassDeclaration' !== classNode?.type || true !== classNode.id?.name.endsWith('Page')) {
		return null;
	}

	const arg = node.expression.arguments[0];

	if (!arg || 'ObjectExpression' !== arg.type) {
		return null;
	}

	const selectorProp = arg.properties.find(
		(prop) => 'Property' === prop.type && 'selector' === prop.key.name,
	);

	return selectorProp ? { name: classNode.id.name, props: arg.properties, selectorProp } : null;
}

// Takes the surrounding comma with it, whichever side of the property it sits on.
function removeSelector(fixer, props, selectorProp) {
	const index = props.indexOf(selectorProp);

	if (1 === props.length) {
		return fixer.remove(selectorProp);
	}

	if (index === props.length - 1) {
		return fixer.removeRange([props[index - 1].range[1], selectorProp.range[1]]);
	}

	return fixer.removeRange([selectorProp.range[0], props[index + 1].range[0]]);
}

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

				const found = findPageSelector(node);

				if (!found) {
					return;
				}

				context.report({
					node: found.selectorProp,
					message: MESSAGE,
					data: { name: found.name },
					fix: (fixer) => removeSelector(fixer, found.props, found.selectorProp),
				});
			},
		};
	},
};

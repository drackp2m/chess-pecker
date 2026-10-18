import { flatten } from './geometry.mjs';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const join = (numbers) =>
	numbers.reduce((text, number) => {
		const value = String(Math.round(number));

		return '' === text || value.startsWith('-') ? `${text}${value}` : `${text} ${value}`;
	}, '');

const shortest = (...options) => options.reduce((a, b) => (b.length < a.length ? b : a));

const lineTo = ([cx, cy], [x, y]) => {
	if (y === cy) {
		return shortest(`H${join([x])}`, `h${join([x - cx])}`);
	}

	if (x === cx) {
		return shortest(`V${join([y])}`, `v${join([y - cy])}`);
	}

	return shortest(`L${join([x, y])}`, `l${join([x - cx, y - cy])}`);
};

const curveTo = ([cx, cy], values) => {
	const relative = values.slice(2).map((value, index) => value - (0 === index % 2 ? cx : cy));

	return shortest(`C${join(values.slice(2))}`, `c${join(relative)}`);
};

const isStraight = (curve, [x1, y1, h1x, h1y, h2x, h2y, x2, y2]) =>
	curve.isStraight() || (h1x === x1 && h1y === y1 && h2x === x2 && h2y === y2);

const subpath = (path) => {
	const curves = path.curves;
	const start = curves[0].getValues().slice(0, 2).map(Math.round);
	let current = start;
	let data = `M${join(start)}`;

	curves.forEach((curve, index) => {
		const values = curve.getValues().map(Math.round);
		const end = values.slice(6);
		const closes = index === curves.length - 1 && end[0] === start[0] && end[1] === start[1];

		if (!isStraight(curve, values)) {
			data += curveTo(current, values);
		} else if (!closes) {
			data += lineTo(current, end);
		}

		current = end;
	});

	return `${data}z`;
};

export const pathData = (item) =>
	flatten(item)
		.filter((path) => 0 < path.curves.length)
		.map(subpath)
		.join('');

export const toSvg = (width, height, item) => {
	const path = `<path d="${pathData(item)}"/>`;

	return `<svg xmlns="${SVG_NAMESPACE}" viewBox="0 0 ${width} ${height}">${path}</svg>\n`;
};

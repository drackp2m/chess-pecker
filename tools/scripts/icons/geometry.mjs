import { createRequire } from 'node:module';

const load = createRequire(import.meta.url);

globalThis.self = { navigator: { userAgent: `Node.js (${process.platform})` } };

const paper = load('paper/dist/paper-core.js');

delete globalThis.self;

paper.setup(new paper.Size(1024, 1024));
paper.settings.insertItems = false;

export { paper };

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export const point = (x, y) => new paper.Point(x, y);

export const polar = (cx, cy, radius, angle) => [
	cx + radius * Math.cos(toRadians(angle)),
	cy + radius * Math.sin(toRadians(angle)),
];

export const flatten = (item) =>
	item instanceof paper.CompoundPath ? item.children.flatMap(flatten) : [item];

export const circle = (cx, cy, radius) => new paper.Path.Circle({ center: [cx, cy], radius });

export const rect = (x, y, width, height, radius = 0) =>
	new paper.Path.Rectangle({ point: [x, y], size: [width, height], radius });

export const polygon = (points) => new paper.Path({ segments: points, closed: true });

export const pathOf = (data) => new paper.Path(data);

export const union = (...items) => items.reduce((acc, item) => acc.unite(item));

export const subtract = (base, ...items) => items.reduce((acc, item) => acc.subtract(item), base);

export const intersect = (a, b) => a.intersect(b);

export const capsule = (from, to, width) => {
	const start = point(...from);
	const vector = point(...to).subtract(start);

	if (0.01 > vector.length) {
		return circle(start.x, start.y, width / 2);
	}

	const half = width / 2;
	const shape = rect(start.x - half, start.y - half, vector.length + width, width, half);

	shape.rotate(vector.angle, start);

	return shape;
};

export const line = (points, width) =>
	union(...points.slice(1).map((to, index) => capsule(points[index], to, width)));

export const growPolygon = (points, distance) => {
	const next = (index) => points[(index + 1) % points.length];

	return union(
		polygon(points),
		...points.map((from, index) => capsule(from, next(index), distance * 2)),
	);
};

const arcPath = (cx, cy, radius, from, to) => {
	const path = new paper.Path();
	const steps = Math.max(1, Math.ceil(Math.abs(to - from) / 90));
	const on = (step) => point(...polar(cx, cy, radius, from + ((to - from) * step) / steps));

	path.moveTo(on(0));

	for (let step = 1; step <= steps; step++) {
		path.arcTo(on(step - 0.5), on(step));
	}

	return path;
};

export const sector = (cx, cy, inner, outer, from, to) => {
	const path = arcPath(cx, cy, outer, from, to);

	path.join(arcPath(cx, cy, inner, to, from));
	path.closePath();

	return path;
};

export const arc = (cx, cy, radius, from, to, width, caps = [true, true]) => {
	const ends = [from, to]
		.filter((_, index) => caps[index])
		.map((angle) => circle(...polar(cx, cy, radius, angle), width / 2));

	return union(sector(cx, cy, radius - width / 2, radius + width / 2, from, to), ...ends);
};

export const arrowHead = (cx, cy, radius, angle, base, length) => {
	const tip = point(...polar(cx, cy, radius, angle));
	const outward = point(...polar(0, 0, 1, angle));
	const ahead = point(-outward.y, outward.x);
	const back = tip.subtract(ahead.multiply(length * 0.12));

	return polygon([
		back.add(outward.multiply(base / 2)),
		tip.add(ahead.multiply(length)),
		back.subtract(outward.multiply(base / 2)),
	]);
};

export const mirror = (shape, width) => {
	const copy = shape.clone();

	copy.scale(-1, 1, point(width / 2, 0));

	return copy;
};

export const rotate = (shape, angle, cx, cy) => {
	const copy = shape.clone();

	copy.rotate(angle, point(cx, cy));

	return copy;
};

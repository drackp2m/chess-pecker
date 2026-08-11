import { ChartLineCurve } from '@app/component/activity-chart/chart-data';

export interface Vertex {
	readonly x: number;
	readonly y: number;
}

export function toPath(vertices: readonly Vertex[], curve: ChartLineCurve): string {
	const [first, ...rest] = vertices;

	if (undefined === first) {
		return '';
	}

	const segments = rest.map((vertex, index) =>
		'smooth' === curve ? toCurveSegment(vertices, index) : `L ${coordinates(vertex)}`,
	);

	return [`M ${coordinates(first)}`, ...segments].join(' ');
}

function toCurveSegment(vertices: readonly Vertex[], index: number): string {
	const previous = vertices[Math.max(0, index - 1)];
	const start = vertices[index];
	const end = vertices[index + 1];
	const next = vertices[Math.min(vertices.length - 1, index + 2)];

	if (undefined === previous || undefined === start || undefined === end || undefined === next) {
		return '';
	}

	const flat = start.y === end.y;
	const first = {
		x: start.x + (end.x - previous.x) / 6,
		y: flat ? start.y : start.y + (end.y - previous.y) / 6,
	};
	const second = {
		x: end.x - (next.x - start.x) / 6,
		y: flat ? end.y : end.y - (next.y - start.y) / 6,
	};

	return `C ${coordinates(first)} ${coordinates(second)} ${coordinates(end)}`;
}

function coordinates(vertex: Vertex): string {
	return `${vertex.x.toFixed(2)} ${vertex.y.toFixed(2)}`;
}

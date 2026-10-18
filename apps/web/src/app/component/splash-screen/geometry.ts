export interface Point {
	readonly x: number;
	readonly y: number;
}

export interface Box extends Point {
	readonly width: number;
	readonly height: number;
}

export function ringOf(points: readonly Point[], size: number): Point[] {
	const step = perimeterOf(points) / size;
	const ring: Point[] = [];
	let walked = 0;

	for (const [index, from] of points.entries()) {
		const to = points[(index + 1) % points.length] ?? from;
		const length = Math.hypot(to.x - from.x, to.y - from.y);

		while (ring.length < size && ring.length * step <= walked + length) {
			ring.push(mixed(from, to, 0 < length ? (ring.length * step - walked) / length : 0));
		}

		walked += length;
	}

	return ring;
}

function perimeterOf(points: readonly Point[]): number {
	return points.reduce((sum, from, index) => {
		const to = points[(index + 1) % points.length] ?? from;

		return sum + Math.hypot(to.x - from.x, to.y - from.y);
	}, 0);
}

export function areaOf(ring: readonly Point[]): number {
	return ring.reduce((sum, from, index) => {
		const to = ring[(index + 1) % ring.length] ?? from;

		return sum + from.x * to.y - to.x * from.y;
	}, 0);
}

export function along(ring: readonly Point[], spot: number): Point {
	const position = (spot - Math.floor(spot)) * ring.length;
	const index = Math.floor(position);
	const from = ring[index % ring.length] ?? { x: 0, y: 0 };

	return mixed(from, ring[(index + 1) % ring.length] ?? from, position - index);
}

export function moved(point: Point, way: Point, distance: number): Point {
	return { x: point.x + way.x * distance, y: point.y + way.y * distance };
}

export function mixed(from: Point, to: Point, share: number): Point {
	return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
}

export function normalized(vector: Point): Point {
	const length = Math.hypot(vector.x, vector.y);

	return 0 < length ? { x: vector.x / length, y: vector.y / length } : vector;
}

export function turned(vector: Point, angle: number): Point {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

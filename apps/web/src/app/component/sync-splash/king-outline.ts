const KING_WIDTH = 268;
const KING_HEIGHT = 666;
const KING_AXIS = KING_WIDTH / 2;
const KING_MIDDLE = KING_HEIGHT / 2;
const KING_PROFILE =
	'M134 0C138.4 0.5 145.3 1 147.2 1.5C151 2.5 152.3 3.5 153.8 4.5C156.2 6.2 156.6 7.8 159 9.5C160.5 10.5 164.8 11.5 165.9 12.5C168 14.5 169.8 16.5 169.8 18.5C169.8 20.2 169.1 21.8 168.6 23.5C167.9 25.8 164.8 28.2 164.8 30.5C164.8 31.2 165.2 31.8 165.6 32.5C166.5 34.2 171.1 35.8 174.9 37.5C177.9 38.8 184.6 40.2 186.4 41.5C188.1 42.8 189.7 44.2 189.8 45.5C190 54.5 190 63.5 190 72.5C190 74.2 188.4 75.8 186.9 77.5C184.4 80.5 173.8 83.5 172.5 86.5C172.2 87.2 171.9 87.8 171.9 88.5C171.9 90.5 174.3 92.5 174.3 94.5C174.3 96.2 172.1 97.8 172.1 99.5C172.1 100.2 172.3 100.8 172.5 101.5C172.8 102.5 174.3 103.5 175.8 104.5C176.8 105.2 179.4 105.8 180.2 106.5C182.8 108.5 182.6 110.5 185.1 112.5C188.1 114.8 201.7 117.2 207 119.5C213.1 122.2 217.6 124.8 221.2 127.5C223.4 129.2 225.8 130.8 226.6 132.5C227.5 134.2 228.3 135.8 228.3 137.5C228.3 138.8 228.2 140.2 228.2 141.5C228.1 143.8 226.4 146.2 225.4 148.5C214.8 172.8 194.1 197.2 187.4 221.5C187.2 222.2 186.9 222.8 186.9 223.5C186.9 225.2 188.9 226.8 188.9 228.5C188.9 230.5 184.7 232.5 184.7 234.5C184.5 238.2 184.5 241.8 184.5 245.5C184.5 247.8 184.8 250.2 186 252.5C186.3 253.2 194.5 253.8 196.6 254.5C200.9 255.8 203.4 257.2 205.2 258.5C207.5 260.2 209.1 261.8 210.1 263.5C211.4 265.5 211.4 267.5 212.9 269.5C213.9 270.8 215.1 272.2 218.8 273.5C219.8 273.8 224.9 274.2 225.7 274.5C229.9 276.2 230.9 277.8 232.1 279.5C232.7 280.5 233.5 281.5 233.5 282.5C233.5 284.2 231.8 285.8 230.2 287.5C228.6 289.2 226 290.8 221.3 292.5C219.5 293.2 216.2 293.8 211.6 294.5C206.9 295.2 188.9 295.8 187.4 296.5C184.3 297.8 183 299.2 182.8 300.5C180.5 318.8 180.1 337.2 180.1 355.5C180.1 366.2 180.6 376.8 181.1 387.5C181.7 402.8 183.8 418.2 186.1 433.5C187.5 442.8 189.8 452.2 192.2 461.5C194.6 470.8 195.8 480.2 201.1 489.5C201.9 490.8 203.6 492.2 205.5 493.5C207.3 494.8 212.1 496.2 213.6 497.5C214.7 498.5 215.8 499.5 215.9 500.5C216.2 502.2 216.3 503.8 216.3 505.5C216.3 508.8 214.1 512.2 214.1 515.5C214.1 519.5 215.4 523.5 216.7 527.5C218.6 533.5 224.7 539.5 229.5 545.5C238.1 556.2 252.5 566.8 259.8 577.5C261.9 580.5 264.2 583.5 265.1 586.5C266 589.8 267 593.2 267 596.5C267 600.2 267 603.8 266.9 607.5C266.8 609.5 264.6 611.5 264.6 613.5C264.6 616.5 268 619.5 268 622.5C268 635.2 268 647.8 268 660.5C268 661.8 267.6 663.2 266.9 664.5C266.7 665 265.6 665.5 265 666';
const SAMPLE_PX = 4;
const SWEEP_STEP = Math.PI / 36;
const CROSS_DEPTH = 24;
const CROSS_FROM = 100;
const CROSS_TO = 112;
const CROSS_FACING = (45 * Math.PI) / 180;
const CROSS_ROUNDNESS = 1.2;
const SPIN_MS = 8000;
const WOBBLE = (10 * Math.PI) / 180;
const EYE_DISTANCE = 2000;
const UNTANGLE_REACH = 120;

interface Point {
	readonly x: number;
	readonly y: number;
}

type Curve = readonly [Point, Point, Point, Point];

type Weights = readonly [number, number, number, number];

interface ProfilePoint {
	readonly r: number;
	readonly y: number;
	readonly nr: number;
	readonly ny: number;
}

interface Rim {
	readonly r: number;
	readonly y: number;
	readonly phi: number;
	readonly body: number;
}

interface Solid {
	readonly x: number;
	readonly z: number;
}

interface Crossing {
	readonly index: number;
	readonly point: Point;
}

export interface KingPose {
	readonly turn: number;
	readonly lean: number;
	readonly pitch: number;
}

export const KING_REST: KingPose = { turn: 0, lean: 0, pitch: 0 };

const PROFILE = sampleProfile(KING_PROFILE);

let traced: { readonly pose: KingPose; readonly points: Point[] } | undefined;

export function kingPose(now: number): KingPose {
	const turn = ((2 * Math.PI * now) / SPIN_MS) % (2 * Math.PI);

	return { turn, lean: WOBBLE * Math.cos(turn), pitch: WOBBLE * Math.sin(turn) };
}

export function kingContour(pose: KingPose, place: (point: Point) => Point): Point[] {
	return outlineOf(pose).map(place);
}

export function kingOutline(pose: KingPose, place: (point: Point) => Point): string {
	const points = kingContour(pose, place).map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`);

	return `M${points.join('L')}Z`;
}

export function traceKingOutline(face: HTMLElement): void {
	const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let drawn = '';

	const trace = (now: number): void => {
		if (!face.isConnected) {
			return;
		}

		const pose = still ? KING_REST : kingPose(now);
		const { offsetWidth: width, offsetHeight: height } = face;
		const key = [pose.turn, pose.lean, pose.pitch, width, height].join(' ');

		if (key !== drawn) {
			drawn = key;
			face.style.clipPath = `path('${kingOutline(pose, (point) => scaled(point, width, height))}')`;
		}

		requestAnimationFrame(trace);
	};

	trace(performance.now());
}

function scaled(point: Point, width: number, height: number): Point {
	return { x: point.x * width, y: point.y * height };
}

function outlineOf(pose: KingPose): Point[] {
	if (
		traced?.pose.turn === pose.turn &&
		traced.pose.lean === pose.lean &&
		traced.pose.pitch === pose.pitch
	) {
		return traced.points;
	}

	const rims = sweep(PROFILE.map((point) => rimOf(point, pose)));
	const right = untangle(rims.map((rim) => project(rim, pose, 1)));
	const left = untangle(rims.map((rim) => project(rim, pose, -1))).reverse();
	const points = [...right, ...left].map((point) => lean(point, pose));

	traced = { pose, points };

	return points;
}

function rimOf(point: ProfilePoint, pose: KingPose): Rim {
	const body = bodyWeight(point.y);

	return { r: point.r, y: point.y, phi: body * contour(point, pose.pitch), body };
}

function bodyWeight(y: number): number {
	const t = Math.min(1, Math.max(0, (y - CROSS_FROM) / (CROSS_TO - CROSS_FROM)));

	return t * t * (3 - 2 * t);
}

function contour(point: ProfilePoint, pitch: number): number {
	const lift = Math.tan(pitch);

	if (0 === lift) {
		return 0;
	}

	return Math.asin(Math.min(1, Math.max(-1, (point.ny / point.nr) * lift)));
}

function sweep(rims: Rim[]): Rim[] {
	return rims.flatMap((rim, index) => {
		const previous = rims[index - 1];

		if (undefined === previous) {
			return [rim];
		}

		const steps = Math.max(1, Math.ceil(Math.abs(rim.phi - previous.phi) / SWEEP_STEP));

		return Array.from({ length: steps }, (_, step) => {
			const t = (step + 1) / steps;

			return {
				r: previous.r + (rim.r - previous.r) * t,
				y: previous.y + (rim.y - previous.y) * t,
				phi: previous.phi + (rim.phi - previous.phi) * t,
				body: previous.body + (rim.body - previous.body) * t,
			};
		});
	});
}

function project(rim: Rim, pose: KingPose, side: number): Point {
	const height = rim.y - KING_MIDDLE;
	const body = { x: side * rim.r * Math.cos(rim.phi), z: rim.r * Math.sin(rim.phi) };
	const cross = crossEdge(rim, pose, side);
	const x = rim.body * body.x + (1 - rim.body) * cross.x;
	const z = rim.body * body.z + (1 - rim.body) * cross.z;
	const lift = rim.body * body.z * Math.sin(pose.pitch);

	return {
		x: x * perspective(height, z, pose),
		y: (height * Math.cos(pose.pitch) + lift) * perspective(height, 0, pose),
	};
}

function crossEdge(rim: Rim, pose: KingPose, side: number): Solid {
	const turn = pose.turn - CROSS_FACING;
	const cos = Math.cos(turn);
	const sin = Math.sin(turn);
	const depth = Math.min(rim.r, CROSS_DEPTH);
	const across = Math.abs(rim.r * cos) ** CROSS_ROUNDNESS;
	const deep = Math.abs(depth * sin) ** CROSS_ROUNDNESS;
	const ellipse = Math.hypot(rim.r * cos, depth * sin);

	return {
		x: side * (across + deep) ** (1 / CROSS_ROUNDNESS),
		z: 0 < ellipse ? (side * (rim.r ** 2 - depth ** 2) * sin * cos) / ellipse : 0,
	};
}

function perspective(height: number, z: number, pose: KingPose): number {
	const depth = z * Math.cos(pose.pitch) - height * Math.sin(pose.pitch);

	return EYE_DISTANCE / (EYE_DISTANCE - depth);
}

function lean(point: Point, pose: KingPose): Point {
	const cos = Math.cos(pose.lean);
	const sin = Math.sin(pose.lean);

	return {
		x: (KING_AXIS + point.x * cos - point.y * sin) / KING_WIDTH,
		y: (KING_MIDDLE + point.x * sin + point.y * cos) / KING_HEIGHT,
	};
}

function untangle(points: Point[]): Point[] {
	const result: Point[] = [];
	let index = 0;
	let from = points[index];

	while (undefined !== from) {
		const crossing = firstCrossing(points, from, index);

		result.push(from);
		index = crossing?.index ?? index + 1;
		from = crossing?.point ?? points[index];
	}

	return result;
}

function firstCrossing(points: Point[], from: Point, index: number): Crossing | undefined {
	const to = points[index + 1];
	const last = Math.min(points.length - 2, index + UNTANGLE_REACH);
	let first: Crossing | undefined;

	for (let other = index + 2; undefined !== to && other <= last; other++) {
		const start = points[other];
		const end = points[other + 1];
		const point =
			undefined !== start && undefined !== end ? intersection(from, to, start, end) : undefined;

		if (
			undefined !== point &&
			(undefined === first || distance(from, point) < distance(from, first.point))
		) {
			first = { index: other, point };
		}
	}

	return first;
}

function intersection(a: Point, b: Point, c: Point, d: Point): Point | undefined {
	if (Math.max(c.y, d.y) < Math.min(a.y, b.y) || Math.min(c.y, d.y) > Math.max(a.y, b.y)) {
		return undefined;
	}

	const ab = { x: b.x - a.x, y: b.y - a.y };
	const cd = { x: d.x - c.x, y: d.y - c.y };
	const ac = { x: c.x - a.x, y: c.y - a.y };
	const denominator = ab.x * cd.y - ab.y * cd.x;
	const t = (ac.x * cd.y - ac.y * cd.x) / denominator;
	const u = (ac.x * ab.y - ac.y * ab.x) / denominator;

	if (1e-9 > Math.abs(denominator) || 0 >= t || 1 <= t || 0 >= u || 1 <= u) {
		return undefined;
	}

	return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

function sampleProfile(path: string): ProfilePoint[] {
	const values = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
	const points: ProfilePoint[] = [];
	let from = pointAt(values, 0);

	for (let index = 2; index + 6 <= values.length; index += 6) {
		const curve: Curve = [
			from,
			pointAt(values, index),
			pointAt(values, index + 2),
			pointAt(values, index + 4),
		];

		points.push(...sampleCurve(curve));
		from = curve[3];
	}

	return [...points, profilePoint(from, { x: -1, y: 0 })];
}

function pointAt(values: number[], index: number): Point {
	return { x: values[index] ?? KING_AXIS, y: values[index + 1] ?? 0 };
}

function sampleCurve(curve: Curve): ProfilePoint[] {
	const [a, b, c, d] = curve;
	const reach = distance(a, b) + distance(b, c) + distance(c, d);
	const steps = Math.max(4, Math.ceil(reach / SAMPLE_PX));
	const chord = { x: d.x - a.x, y: d.y - a.y };

	return Array.from({ length: steps + 1 }, (_, step) => {
		const t = step / steps;
		const s = 1 - t;
		const position = mix(curve, [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t]);
		const tangent = mix(curve, [-3 * s * s, 3 * s * (s - 2 * t), 3 * t * (2 * s - t), 3 * t * t]);

		return profilePoint(position, 0 === distance(tangent, { x: 0, y: 0 }) ? chord : tangent);
	});
}

function distance(from: Point, to: Point): number {
	return Math.hypot(to.x - from.x, to.y - from.y);
}

function mix([a, b, c, d]: Curve, [wa, wb, wc, wd]: Weights): Point {
	return {
		x: a.x * wa + b.x * wb + c.x * wc + d.x * wd,
		y: a.y * wa + b.y * wb + c.y * wc + d.y * wd,
	};
}

function profilePoint(position: Point, tangent: Point): ProfilePoint {
	const length = Math.hypot(tangent.x, tangent.y);

	return {
		r: position.x - KING_AXIS,
		y: position.y,
		nr: tangent.y / length,
		ny: -tangent.x / length,
	};
}

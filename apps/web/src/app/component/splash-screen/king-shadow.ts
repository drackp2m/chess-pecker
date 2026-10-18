import type { Point } from '@app/component/splash-screen/geometry';
import { bodyWeight } from '@app/component/splash-screen/king-cross';
import { whenChanged } from '@app/component/splash-screen/king-motion';
import type { KingFrame, KingPainter, KingPose } from '@app/component/splash-screen/king-motion';
import {
	KING_HEIGHT,
	PROFILE,
	contour,
	lean,
	profileAt,
	surface,
} from '@app/component/splash-screen/king-outline';
import type { ProfilePoint } from '@app/component/splash-screen/king-outline';

const LIGHT: Light = [-0.64, -0.28, 0.64];
const SHADE_BIAS = 0.2;
const MAX_RATIO = 2;
const TURN = 2 * Math.PI;
const ARC_STEP = Math.PI / 24;
const SHADOW_FOOT = 8;

type Light = readonly [number, number, number];

interface Scene {
	readonly frame: KingFrame;
	readonly colour: string;
	readonly ratio: number;
}

interface ShadeBand {
	readonly whole: readonly Point[];
	readonly shadows: readonly (readonly Point[])[];
}

interface Segment {
	readonly top: ProfilePoint;
	readonly bottom: ProfilePoint;
	readonly facing: ProfilePoint;
}

interface Span {
	readonly from: number;
	readonly to: number;
}

const SEGMENTS = [...segmentsOf(PROFILE), ...capOf(PROFILE)];

export function kingShadow(shading: HTMLCanvasElement): KingPainter {
	const context = shading.getContext('2d');
	const style = getComputedStyle(shading);
	const draw = whenChanged((scene: Scene) => {
		if (null !== context) {
			paint(context, scene);
		}
	});

	return (frame) => {
		draw({ frame, colour: style.color, ratio: Math.min(window.devicePixelRatio, MAX_RATIO) });
	};
}

function paint(context: CanvasRenderingContext2D, { frame, colour, ratio }: Scene): void {
	const { canvas } = context;
	const left = (canvas.clientWidth - frame.width) / 2;
	const top = (canvas.clientHeight - frame.height) / 2;
	const place = (point: Point): Point => ({
		x: (left + point.x * frame.width) * ratio,
		y: (top + point.y * frame.height) * ratio,
	});

	fit(canvas, ratio);
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = colour;
	context.strokeStyle = colour;
	context.lineJoin = 'round';

	for (const band of bandsOf(frame.pose, place)) {
		context.globalCompositeOperation = 'destination-out';
		fill(context, band.whole);
		context.globalCompositeOperation = 'source-over';

		for (const shadow of band.shadows) {
			fill(context, shadow);
			context.stroke();
		}
	}
}

function fit(canvas: HTMLCanvasElement, ratio: number): void {
	const width = Math.round(canvas.clientWidth * ratio);
	const height = Math.round(canvas.clientHeight * ratio);

	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}
}

function fill(context: CanvasRenderingContext2D, points: readonly Point[]): void {
	context.beginPath();

	for (const { x, y } of points) {
		context.lineTo(x, y);
	}

	context.closePath();
	context.fill();
}

function bandsOf(pose: KingPose, place: (point: Point) => Point): ShadeBand[] {
	const light = unposed(LIGHT, pose);
	const bands = SEGMENTS.map((segment) =>
		bandOf(segment, darkness(segment.facing, light, SHADE_BIAS), pose, place),
	);

	return 0 < pose.pitch ? bands.reverse() : bands;
}

function bandOf(
	segment: Segment,
	dark: Span,
	pose: KingPose,
	place: (point: Point) => Point,
): ShadeBand {
	const start = bodyWeight(segment.facing.y) * contour(segment.facing, pose.pitch);
	const end = Math.PI - start;
	const clamped = (theta: number): number => Math.min(end, Math.max(start, theta));
	const patch = (from: number, to: number): Point[] =>
		patchOf(segment, { from: clamped(from), to: clamped(to) }, pose, place);
	const shadows = [patch(dark.from - TURN, dark.to - TURN), patch(dark.from, dark.to)];

	return {
		whole: patch(start, end),
		shadows: shadows.filter((shadow) => 2 < shadow.length),
	};
}

function segmentsOf(profile: readonly ProfilePoint[]): Segment[] {
	const foot = profileAt(KING_HEIGHT - SHADOW_FOOT);

	return profile.flatMap((top, index) => {
		const bottom = profile[index + 1];
		const length = undefined === bottom ? 0 : Math.hypot(bottom.r - top.r, bottom.y - top.y);

		if (undefined === bottom || 0 === length) {
			return [];
		}

		const [nr, ny] =
			top.y < foot.y
				? [(bottom.y - top.y) / length, (top.r - bottom.r) / length]
				: [foot.nr, foot.ny];

		return [{ top, bottom, facing: { ...top, nr, ny } }];
	});
}

function capOf(profile: readonly ProfilePoint[]): Segment[] {
	const rim = profile[profile.length - 1];

	if (undefined === rim) {
		return [];
	}

	return [{ top: rim, bottom: { ...rim, r: 0 }, facing: { ...rim, nr: 0, ny: 1 } }];
}

function darkness(facing: ProfilePoint, [x, y, z]: Light, bias: number): Span {
	const reach = facing.nr * Math.hypot(x, z);
	const shade = bias - facing.ny * y;
	const lit = Math.atan2(z, x);
	const saturated = 0 < shade ? 0 : Math.PI;
	const spread = reach > Math.abs(shade) ? Math.acos(shade / reach) : saturated;

	return { from: lit + spread, to: lit - spread + TURN };
}

function patchOf(
	{ top, bottom }: Segment,
	span: Span,
	pose: KingPose,
	place: (point: Point) => Point,
): Point[] {
	return [...arcOf(top, span, pose, place), ...arcOf(bottom, span, pose, place).reverse()];
}

function arcOf(
	point: ProfilePoint,
	{ from, to }: Span,
	pose: KingPose,
	place: (point: Point) => Point,
): Point[] {
	const steps = Math.ceil((to - from) / ARC_STEP);

	return Array.from({ length: steps + 1 }, (_, step) => {
		const theta = 0 < steps ? from + ((to - from) * step) / steps : from;

		return place(lean(surface(point, theta, pose), pose));
	});
}

function unposed([x, y, z]: Light, pose: KingPose): Light {
	const across = x * Math.cos(pose.lean) + y * Math.sin(pose.lean);
	const down = y * Math.cos(pose.lean) - x * Math.sin(pose.lean);

	return [
		across,
		down * Math.cos(pose.pitch) - z * Math.sin(pose.pitch),
		down * Math.sin(pose.pitch) + z * Math.cos(pose.pitch),
	];
}

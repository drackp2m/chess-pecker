import {
	along,
	areaOf,
	mixed,
	moved,
	normalized,
	ringOf,
	turned,
} from '@app/component/splash-screen/geometry';
import type { Box, Point } from '@app/component/splash-screen/geometry';
import { drawGlow, glowLayersOf } from '@app/component/splash-screen/halo-glow';
import type { GlowLayer } from '@app/component/splash-screen/halo-glow';
import { whenChanged } from '@app/component/splash-screen/king-motion';
import type { KingFrame, KingPainter, KingPose } from '@app/component/splash-screen/king-motion';
import { kingContour } from '@app/component/splash-screen/king-outline';

const TURN = 2 * Math.PI;
const DEGREE = Math.PI / 180;
const MAX_RATIO = 1.5;
const RING_SIZE = 360;
const RADIAL_PULL = 0.35;
const TIP_SPREAD = 1.6;
const JITTER = 0.8;
const HASH_INDEX = 12.9898;
const HASH_SALT = 78.233;
const HASH_SCALE = 43758.5453;
const SWELL_CRESTS = 3;
const SURGE_CRESTS = 5;
const SURGE_SHARE = 0.4;
const RIPPLE_SHARE = 0.35;
const SWAY_CRESTS = 2;
const DIM = 0.55;
const NARROW = 0.6;
const TINT_BANDS = 3;
const TINT_DRIFT = 2;
const FOCUS_POWER = 6;
const FADE: readonly (readonly [number, string])[] = [
	[0, 'rgb(255 255 255)'],
	[0.2, 'rgb(255 255 255 / 0.75)'],
	[0.6, 'rgb(255 255 255 / 0.2)'],
	[1, 'rgb(255 255 255 / 0)'],
];

interface HaloSettings {
	readonly rays: number;
	readonly rayWidth: number;
	readonly start: number;
	readonly reachMin: number;
	readonly reachMax: number;
	readonly smoothing: number;
	readonly intensity: number;
	readonly glowLayers: readonly GlowLayer[];
	readonly flicker: number;
	readonly spin: number;
	readonly beat: number;
	readonly sway: number;
	readonly flare: number;
	readonly flareSnap: number;
	readonly flareBlink: number;
	readonly warm: string;
	readonly cool: string;
}

interface Scene {
	readonly frame: KingFrame;
	readonly settings: HaloSettings;
	readonly box: Box;
}

interface Ray {
	readonly spot: number;
	readonly width: number;
	readonly phase: number;
	readonly pace: number;
}

interface Clock {
	readonly spin: number;
	readonly beat: number;
	readonly pulse: number;
	readonly aim: number;
}

interface Edge {
	readonly ring: readonly Point[];
	readonly turning: number;
	readonly centre: Point;
	readonly axis: Point;
	readonly side: Point;
	readonly across: number;
	readonly unit: number;
	readonly smoothing: number;
}

interface Beam {
	readonly spot: number;
	readonly base: Point;
	readonly tilt: number;
	readonly half: number;
	readonly from: number;
	readonly reach: number;
	readonly alpha: number;
}

let scattered: readonly Ray[] = [];

export function kingHalo(halo: HTMLCanvasElement): KingPainter {
	const context = halo.getContext('2d');
	const style = getComputedStyle(halo);
	const draw = whenChanged((scene: Scene) => {
		if (null !== context) {
			paint(context, scene);
		}
	});

	return (frame) => {
		draw({ frame, settings: settingsOf(style), box: fit(halo, frame) });
	};
}

function settingsOf(style: CSSStyleDeclaration): HaloSettings {
	return {
		rays: Math.max(0, Math.round(numberOf(style, 'rays'))),
		rayWidth: numberOf(style, 'ray-width'),
		start: numberOf(style, 'start'),
		reachMin: numberOf(style, 'reach-min'),
		reachMax: numberOf(style, 'reach-max'),
		smoothing: Math.max(1 / RING_SIZE, numberOf(style, 'smoothing')),
		intensity: numberOf(style, 'intensity'),
		glowLayers: glowLayersOf(style.getPropertyValue('--halo-glow-layers')),
		flicker: numberOf(style, 'flicker'),
		spin: numberOf(style, 'spin'),
		beat: numberOf(style, 'beat'),
		sway: numberOf(style, 'sway') * DEGREE,
		flare: numberOf(style, 'flare'),
		flareSnap: numberOf(style, 'flare-snap'),
		flareBlink: Math.max(0, numberOf(style, 'flare-blink')),
		warm: style.getPropertyValue('--halo-warm'),
		cool: style.getPropertyValue('--halo-cool'),
	};
}

function numberOf(style: CSSStyleDeclaration, name: string): number {
	const value = Number.parseFloat(style.getPropertyValue(`--halo-${name}`));

	return Number.isFinite(value) ? value : 0;
}

function fit(halo: HTMLCanvasElement, face: KingFrame): Box {
	const ratio = Math.min(window.devicePixelRatio, MAX_RATIO);
	const width = Math.round(halo.clientWidth * ratio);
	const height = Math.round(halo.clientHeight * ratio);

	if (halo.width !== width || halo.height !== height) {
		halo.width = width;
		halo.height = height;
	}

	return {
		x: ((halo.clientWidth - face.width) / 2) * ratio,
		y: ((halo.clientHeight - face.height) / 2) * ratio,
		width: face.width * ratio,
		height: face.height * ratio,
	};
}

function clockAt(settings: HaloSettings, time: number, pose: KingPose): Clock {
	const beat = 0 === settings.beat ? 0 : (TURN * time) / settings.beat;

	return {
		spin: 0 === settings.spin ? 0 : (-TURN * time) / settings.spin,
		beat,
		pulse: ((1 + Math.cos(beat)) / 2) ** settings.flareBlink,
		aim: aimOf(pose, settings.flareSnap),
	};
}

function aimOf(pose: KingPose, snap: number): number {
	const tilt = Math.hypot(pose.lean, pose.pitch);
	const sway = (0 < tilt ? Math.atan2(pose.pitch, pose.lean) : Math.PI / 2) - Math.PI / 2;
	const linger = Math.max(0, snap) / (1 + Math.max(0, snap));

	return sway - (linger * Math.sin(2 * sway)) / 2 - Math.PI / 2;
}

function paint(context: CanvasRenderingContext2D, { frame, settings, box }: Scene): void {
	const { pose, time } = frame;
	const edge = edgeOf(box, pose, settings.smoothing);
	const clock = clockAt(settings, time, pose);

	context.clearRect(0, 0, context.canvas.width, context.canvas.height);
	drawGlow(context, edge.ring, edge.unit, settings.glowLayers);
	context.globalCompositeOperation = 'lighter';

	for (const ray of raysOf(settings.rays)) {
		drawBeam(context, edge, beamOf(ray, edge, settings, clock));
	}

	tint(context, settings, clock);
}

function edgeOf(box: Box, pose: KingPose, smoothing: number): Edge {
	const ring = ringOf(
		kingContour(pose, (point) => placed(point, box)),
		RING_SIZE,
	);

	return {
		ring,
		turning: Math.sign(areaOf(ring)),
		centre: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
		axis: { x: -Math.sin(pose.lean), y: Math.cos(pose.lean) },
		side: { x: Math.cos(pose.lean), y: Math.sin(pose.lean) },
		across: box.width / 2,
		unit: box.height,
		smoothing,
	};
}

function drawBeam(context: CanvasRenderingContext2D, edge: Edge, beam: Beam): void {
	const from = beam.from * edge.unit;
	const reach = beam.reach * edge.unit;

	if (reach <= from || 0 >= beam.alpha) {
		return;
	}

	const way = turned(heading(edge, beam.spot, beam.base), beam.tilt);
	const start = moved(beam.base, way, from);
	const tip = moved(beam.base, way, reach);

	shaftPath(context, start, tip, { x: -way.y, y: way.x }, beam.half * edge.unit);
	context.globalAlpha = beam.alpha;
	context.fillStyle = faded(context.createLinearGradient(start.x, start.y, tip.x, tip.y));
	context.fill();
}

function shaftPath(
	context: CanvasRenderingContext2D,
	start: Point,
	tip: Point,
	side: Point,
	half: number,
): void {
	const corners = [
		moved(start, side, half),
		moved(tip, side, half * TIP_SPREAD),
		moved(tip, side, -half * TIP_SPREAD),
		moved(start, side, -half),
	];

	context.beginPath();

	for (const corner of corners) {
		context.lineTo(corner.x, corner.y);
	}
}

function tint(context: CanvasRenderingContext2D, settings: HaloSettings, clock: Clock): void {
	const { width, height } = context.canvas;
	const hue = context.createConicGradient(TINT_DRIFT * clock.spin, width / 2, height / 2);

	for (let band = 0; band <= 2 * TINT_BANDS; band++) {
		hue.addColorStop(band / (2 * TINT_BANDS), 0 === band % 2 ? settings.warm : settings.cool);
	}

	context.globalCompositeOperation = 'source-in';
	context.globalAlpha = 1;
	context.fillStyle = hue;
	context.fillRect(0, 0, width, height);
}

function faded(gradient: CanvasGradient): CanvasGradient {
	for (const [offset, colour] of FADE) {
		gradient.addColorStop(offset, colour);
	}

	return gradient;
}

function beamOf(ray: Ray, edge: Edge, settings: HaloSettings, clock: Clock): Beam {
	const angle = TURN * ray.spot;
	const spot = ray.spot + clock.spin / TURN;
	const base = along(edge.ring, spot);
	const boost = settings.flare * clock.pulse * nearness(edge, base, clock.aim);
	const swell = waveAt(ray, clock.beat);
	const lift = swell + (1 - swell) * Math.min(1, boost);
	const twinkle = (1 + Math.sin(clock.beat * ray.pace + ray.phase)) / 2;
	const glow = (1 - settings.flicker * twinkle) * (DIM + (1 - DIM) * lift) * (1 + boost);

	return {
		spot,
		base,
		tilt: settings.sway * Math.sin(clock.beat + SWAY_CRESTS * angle),
		half: (settings.rayWidth / 2) * ray.width * (NARROW + 2 * (1 - NARROW) * lift),
		from: settings.start,
		reach: settings.reachMin + (settings.reachMax - settings.reachMin) * lift,
		alpha: Math.min(1, Math.max(0, settings.intensity * glow)),
	};
}

function waveAt(ray: Ray, beat: number): number {
	const angle = TURN * ray.spot;
	const swell = Math.cos(SWELL_CRESTS * angle + beat);
	const surge = Math.cos(SURGE_CRESTS * angle + 2 * beat);
	const ripple = Math.sin(2 * beat + ray.phase);
	const wave = (1 - SURGE_SHARE) * swell + SURGE_SHARE * surge;

	return (1 + (1 - RIPPLE_SHARE) * wave + RIPPLE_SHARE * ripple) / 2;
}

function nearness(edge: Edge, point: Point, aim: number): number {
	return Math.max(0, Math.cos(bearing(edge, point) - aim)) ** FOCUS_POWER;
}

function bearing(edge: Edge, point: Point): number {
	const x = point.x - edge.centre.x;
	const y = point.y - edge.centre.y;
	const down = (x * edge.axis.x + y * edge.axis.y) / (edge.unit / 2);

	return Math.atan2(down, (x * edge.side.x + y * edge.side.y) / edge.across);
}

function raysOf(count: number): readonly Ray[] {
	if (scattered.length !== count) {
		scattered = Array.from({ length: count }, (_, index) => rayAt(index, count));
	}

	return scattered;
}

function rayAt(index: number, count: number): Ray {
	return {
		spot: (index + JITTER * (noise(index, 1) - 0.5)) / count,
		width: 0.5 + noise(index, 2),
		phase: TURN * noise(index, 3),
		pace: 0.5 + noise(index, 4),
	};
}

function noise(index: number, salt: number): number {
	const value = Math.sin(index * HASH_INDEX + salt * HASH_SALT) * HASH_SCALE;

	return value - Math.floor(value);
}

function heading(edge: Edge, spot: number, base: Point): Point {
	const before = along(edge.ring, spot - edge.smoothing);
	const after = along(edge.ring, spot + edge.smoothing);
	const normal = normalized({
		x: edge.turning * (after.y - before.y),
		y: edge.turning * (before.x - after.x),
	});
	const radial = normalized({ x: base.x - edge.centre.x, y: base.y - edge.centre.y });

	return normalized(mixed(normal, radial, RADIAL_PULL));
}

function placed(point: Point, box: Box): Point {
	return { x: box.x + point.x * box.width, y: box.y + point.y * box.height };
}

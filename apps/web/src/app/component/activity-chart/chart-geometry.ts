import {
	ChartAxes,
	ChartAxis,
	ChartScaleOptions,
	buildAxes,
	resolveScales,
} from '@app/component/activity-chart/chart-axis';
import { fitSlots } from '@app/util/fit-slots';
import { linearScale } from '@app/util/scale';

const LABEL_MIN_WIDTH = 28;

export const DEFAULT_MIN_BAR_WIDTH = 12;
export const DEFAULT_TICK_COUNT = 4;
export const DEFAULT_MAX_DROP_RATIO = 1;

export type ChartStackMode = 'stacked' | 'overlay';
export type ChartStackOrder = 'input' | 'ascending' | 'descending' | readonly number[];
export type ChartIssue = 'bar-too-narrow' | 'too-many-points';
export type ChartLineCurve = 'linear' | 'smooth';

export type ChartBarSpacingMode = 'gap' | 'ratio' | 'fixed';

export interface ChartLineStyle {
	readonly curve?: ChartLineCurve;
	readonly width?: number;
	readonly dash?: string | null;
}

export interface ChartBarSpacing {
	readonly mode: ChartBarSpacingMode;
	readonly size: number;
}

export type ChartLineStyleResolved = Required<ChartLineStyle>;

export const DEFAULT_LINE_STYLE: ChartLineStyleResolved = {
	curve: 'linear',
	width: 1.5,
	dash: null,
};
export const DEFAULT_BAR_SPACING: ChartBarSpacing = { mode: 'ratio', size: 0.68 };

export function resolveLineStyle(style: ChartLineStyle | undefined): ChartLineStyleResolved {
	return { ...DEFAULT_LINE_STYLE, ...style };
}

export interface ChartPoint {
	readonly key: string;
	readonly label: string;
	readonly description: string;
	readonly stack: readonly number[];
	readonly lines: readonly number[];
}

export interface ChartSegment {
	readonly index: number;
	readonly y: number;
	readonly height: number;
}

export interface ChartBar {
	readonly key: string;
	readonly x: number;
	readonly width: number;
	readonly segments: readonly ChartSegment[];
}

export interface ChartSlot {
	readonly key: string;
	readonly x: number;
	readonly width: number;
	readonly center: number;
}

export interface ChartLine {
	readonly index: number;
	readonly path: string;
	readonly width: number;
	readonly dash: string | null;
}

export interface ChartGeometry {
	readonly points: readonly ChartPoint[];
	readonly slots: readonly ChartSlot[];
	readonly bars: readonly ChartBar[];
	readonly lines: readonly ChartLine[];
	readonly axes: readonly ChartAxis[];
	readonly barMax: number;
	readonly lineMax: number;
	readonly labelStep: number;
	readonly dropped: number;
	readonly issue: ChartIssue | null;
}

export interface ChartGeometryOptions {
	readonly width: number;
	readonly height: number;
	readonly minSlot: number;
	readonly barSpacing?: ChartBarSpacing;
	readonly minBarWidth?: number;
	readonly maxDropRatio?: number;
	readonly stackMode?: ChartStackMode;
	readonly stackOrder?: ChartStackOrder;
	readonly axes?: ChartAxes;
	readonly sharedScale?: boolean;
	readonly tickCount?: number;
	readonly lineStyles?: readonly ChartLineStyle[];
}

interface Vertex {
	readonly x: number;
	readonly y: number;
}

interface BarOptions {
	readonly height: number;
	readonly stackMode: ChartStackMode;
	readonly stackOrder: ChartStackOrder;
}

const EMPTY: ChartGeometry = {
	points: [],
	slots: [],
	bars: [],
	lines: [],
	axes: [],
	barMax: 0,
	lineMax: 0,
	labelStep: 1,
	dropped: 0,
	issue: null,
};

/** The newest point owns the right edge: whatever does not fit drops off the left. */
export function buildChartGeometry(
	points: readonly ChartPoint[],
	options: ChartGeometryOptions,
): ChartGeometry {
	const required = toRequiredSlot(options);
	const fit = fitSlots(
		options.width,
		Math.max(options.minSlot, required),
		points.length,
		'stretch',
	);

	if (0 === fit.count) {
		return EMPTY;
	}

	const dropped = points.length - fit.count;

	if (options.width < required) {
		return { ...EMPTY, dropped, issue: 'bar-too-narrow' };
	}

	const budget = points.length * (options.maxDropRatio ?? DEFAULT_MAX_DROP_RATIO);

	if (budget < dropped) {
		return { ...EMPTY, dropped, issue: 'too-many-points' };
	}

	return toGeometry(points.slice(dropped), fit.size, dropped, options);
}

function toRequiredSlot(options: ChartGeometryOptions): number {
	const spacing = options.barSpacing ?? DEFAULT_BAR_SPACING;
	const minBarWidth = options.minBarWidth ?? DEFAULT_MIN_BAR_WIDTH;

	if ('fixed' === spacing.mode) {
		return Math.max(0, spacing.size);
	}

	if ('gap' === spacing.mode) {
		return minBarWidth + Math.max(0, spacing.size);
	}

	const ratio = Math.min(1, Math.max(0, spacing.size));

	return 0 === ratio ? Infinity : minBarWidth / ratio;
}

function toGeometry(
	visible: readonly ChartPoint[],
	slotSize: number,
	dropped: number,
	options: ChartGeometryOptions,
): ChartGeometry {
	const barOptions = toBarOptions(options);
	const scaleOptions = toScaleOptions(options);
	const spacing = options.barSpacing ?? DEFAULT_BAR_SPACING;
	const rawBarMax = maxBar(visible, barOptions.stackMode);
	const scales = resolveScales(rawBarMax, maxLine(visible), scaleOptions);
	const slots = visible.map((point, index) => toSlot(point, index, slotSize));
	const bars = visible.map((point, index) =>
		toBar(point, slots[index], spacing, scales.barMax, barOptions),
	);

	return {
		points: visible,
		slots,
		bars,
		lines: toLines(visible, slots, scales.lineMax, options),
		axes: buildAxes(scales, options.height, scaleOptions),
		barMax: scales.barMax,
		lineMax: scales.lineMax,
		labelStep: Math.max(1, Math.ceil(LABEL_MIN_WIDTH / slotSize)),
		dropped,
		issue: null,
	};
}

function toBarOptions(options: ChartGeometryOptions): BarOptions {
	return {
		height: options.height,
		stackMode: options.stackMode ?? 'stacked',
		stackOrder: options.stackOrder ?? 'input',
	};
}

function toScaleOptions(options: ChartGeometryOptions): ChartScaleOptions {
	return {
		axes: options.axes ?? 'bars',
		sharedScale: options.sharedScale ?? true,
		tickCount: options.tickCount ?? DEFAULT_TICK_COUNT,
	};
}

function toBarWidth(slotSize: number, spacing: ChartBarSpacing): number {
	if ('fixed' === spacing.mode) {
		return Math.min(slotSize, Math.max(0, spacing.size));
	}

	return 'gap' === spacing.mode
		? slotSize - Math.max(0, spacing.size)
		: slotSize * Math.min(1, Math.max(0, spacing.size));
}

/** Slot edges land on whole pixels, so bars that touch share an edge instead of a seam. */
function toSlot(point: ChartPoint, index: number, size: number): ChartSlot {
	const x = Math.round(index * size);
	const width = Math.round((index + 1) * size) - x;

	return { key: point.key, x, width, center: x + width / 2 };
}

function toBar(
	point: ChartPoint,
	slot: ChartSlot | undefined,
	spacing: ChartBarSpacing,
	barMax: number,
	options: BarOptions,
): ChartBar {
	const slotWidth = slot?.width ?? 0;
	const width = toBarWidth(slotWidth, spacing);

	return {
		key: point.key,
		x: (slot?.x ?? 0) + (slotWidth - width) / 2,
		width,
		segments: toSegments(point.stack, barMax, options),
	};
}

function toSegments(
	stack: readonly number[],
	barMax: number,
	options: BarOptions,
): readonly ChartSegment[] {
	const overlay = 'overlay' === options.stackMode;
	const order = overlay ? 'descending' : options.stackOrder;
	let value = 0;
	let base = 0;

	return stackOrderIndices(stack, order)
		.map((index) => {
			value = overlay ? (stack[index] ?? 0) : value + (stack[index] ?? 0);

			const top = Math.round(scaleTo(value, barMax, options.height));
			const height = overlay ? top : top - base;

			base = top;

			return { index, y: options.height - top, height };
		})
		.filter((segment) => 0 < segment.height);
}

function stackOrderIndices(stack: readonly number[], order: ChartStackOrder): readonly number[] {
	const indices = stack.map((_unused, index) => index);

	if ('input' === order) {
		return indices;
	}

	if ('ascending' === order || 'descending' === order) {
		const direction = 'ascending' === order ? 1 : -1;
		const byValue = (left: number, right: number): number =>
			direction * ((stack[left] ?? 0) - (stack[right] ?? 0));

		return [...indices].sort(byValue);
	}

	const listed = order.filter((index) => indices.includes(index));

	return [...listed, ...indices.filter((index) => !listed.includes(index))];
}

function toLines(
	points: readonly ChartPoint[],
	slots: readonly ChartSlot[],
	lineMax: number,
	options: ChartGeometryOptions,
): readonly ChartLine[] {
	const count = Math.max(0, ...points.map((point) => point.lines.length));

	return Array.from({ length: count }, (_unused, index) => {
		const style = resolveLineStyle(options.lineStyles?.[index]);
		const vertices = points.map((point, slotIndex) => ({
			x: slots[slotIndex]?.center ?? 0,
			y: options.height - scaleTo(point.lines[index] ?? 0, lineMax, options.height),
		}));

		return { index, path: toPath(vertices, style.curve), width: style.width, dash: style.dash };
	});
}

function toPath(vertices: readonly Vertex[], curve: ChartLineCurve): string {
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

function scaleTo(value: number, max: number, height: number): number {
	return 0 >= max ? 0 : linearScale(value, { min: 0, max }, height);
}

function maxBar(points: readonly ChartPoint[], mode: ChartStackMode): number {
	return 'overlay' === mode
		? Math.max(0, ...points.flatMap((point) => [...point.stack]))
		: Math.max(0, ...points.map((point) => sum(point.stack)));
}

function maxLine(points: readonly ChartPoint[]): number {
	return Math.max(0, ...points.flatMap((point) => [...point.lines]));
}

function sum(values: readonly number[]): number {
	return values.reduce((total, value) => total + value, 0);
}

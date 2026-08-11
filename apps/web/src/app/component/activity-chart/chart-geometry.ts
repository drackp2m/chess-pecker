import {
	ChartAxis,
	ChartScaleOptions,
	ChartScales,
	buildAxes,
	resolveScales,
	toChartY,
} from '@app/component/activity-chart/chart-axis';
import { ChartConfigResolved, ChartStackMode } from '@app/component/activity-chart/chart-config';
import {
	ChartData,
	ChartPoint,
	ChartSeriesResolved,
	seriesValue,
	toBarSeries,
	toLineSeries,
} from '@app/component/activity-chart/chart-data';
import { ChartBarLayout, fitBars } from '@app/component/activity-chart/chart-layout';
import { toPath } from '@app/component/activity-chart/chart-path';
import { NiceScale, ScaleBounds } from '@app/util/scale';

const LABEL_MIN_WIDTH = 28;

export type ChartIssue = 'bar-too-narrow' | 'too-many-points';

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
	readonly barScale: NiceScale;
	readonly lineScale: NiceScale;
	readonly zeroY: number;
	readonly labelStep: number;
	readonly dropped: number;
	readonly width: number;
	readonly viewport: number | null;
	readonly issue: ChartIssue | null;
}

type StackOrder = 'input' | 'ascending' | 'descending' | readonly number[];

interface SegmentEdges {
	readonly start: number;
	readonly end: number;
}

interface BarOptions {
	readonly height: number;
	readonly bar: number;
	readonly gap: number;
	readonly stackMode: ChartStackMode;
	readonly stackOrder: StackOrder;
	readonly baselineWidth: number;
}

interface VisibleData {
	readonly points: readonly ChartPoint[];
	readonly bars: readonly ChartSeriesResolved[];
	readonly lines: readonly ChartSeriesResolved[];
}

const FLAT: NiceScale = { min: 0, max: 0, step: 0 };

const EMPTY: ChartGeometry = {
	points: [],
	slots: [],
	bars: [],
	lines: [],
	axes: [],
	barScale: FLAT,
	lineScale: FLAT,
	zeroY: 0,
	labelStep: 1,
	dropped: 0,
	width: 0,
	viewport: null,
	issue: null,
};

/**
 * The first point owns the starting edge — left reading `ltr`, right reading `rtl` — so
 * whatever does not fit drops off the far end, which is the opposite edge.
 */
export function buildChartGeometry(
	data: ChartData,
	config: ChartConfigResolved,
	width: number,
): ChartGeometry {
	const total = data.points.length;
	const layout = fitBars(width, total, config.bars, config.overflow);

	if (0 === layout.count) {
		return 0 < width && 0 < total ? { ...EMPTY, dropped: total, issue: 'bar-too-narrow' } : EMPTY;
	}

	const dropped = Math.max(0, total - layout.count);

	if (total * config.overflow.maxDropRatio < dropped) {
		return { ...EMPTY, dropped, issue: 'too-many-points' };
	}

	const visible = {
		points: data.points.slice(0, layout.count),
		bars: toBarSeries(data),
		lines: toLineSeries(data),
	};

	return toGeometry(visible, layout, dropped, config);
}

function toGeometry(
	visible: VisibleData,
	layout: ChartBarLayout,
	dropped: number,
	config: ChartConfigResolved,
): ChartGeometry {
	const barOptions = toBarOptions(config, visible.bars, layout);
	const scaleOptions = toScaleOptions(config);
	const stacks = toStacks(visible);
	const scales = toScales(stacks, visible, barOptions.stackMode, scaleOptions);
	const slots = visible.points.map((point, index) =>
		toSlot(point, toColumn(index, layout.columns, config), layout.slot),
	);

	return {
		points: visible.points,
		slots,
		bars: toBars(stacks, slots, scales.bar, barOptions),
		lines: toLines(visible.lines, slots, scales.line, config.layout.height),
		axes: buildAxes(scales, config.layout.height, scaleOptions),
		barScale: scales.bar,
		lineScale: scales.line,
		zeroY: toChartY(0, scales.bar, config.layout.height),
		labelStep: toLabelStep(config, layout.slot),
		dropped,
		width: layout.content,
		viewport: layout.viewport,
		issue: null,
	};
}

function toScales(
	stacks: readonly (readonly number[])[],
	visible: VisibleData,
	mode: ChartStackMode,
	options: ChartScaleOptions,
): ChartScales {
	return resolveScales(barBounds(stacks, mode), lineBounds(visible), options);
}

function toStacks(visible: VisibleData): readonly (readonly number[])[] {
	return visible.points.map((_unused, index) =>
		visible.bars.map((series) => seriesValue(series, index)),
	);
}

function toColumn(index: number, total: number, config: ChartConfigResolved): number {
	return 'rtl' === config.layout.direction ? total - 1 - index : index;
}

function toLabelStep(config: ChartConfigResolved, slotSize: number): number {
	return 'auto' === config.labels.step
		? Math.max(1, Math.ceil(LABEL_MIN_WIDTH / slotSize))
		: Math.max(1, Math.round(config.labels.step));
}

function toBarOptions(
	config: ChartConfigResolved,
	series: readonly ChartSeriesResolved[],
	layout: ChartBarLayout,
): BarOptions {
	const order = config.bars.order;

	return {
		height: config.layout.height,
		bar: layout.bar,
		gap: layout.slot - layout.bar,
		stackMode: config.bars.stack,
		stackOrder: 'string' === typeof order ? order : toOrderIndices(order, series),
		baselineWidth: config.guides.baseline.show ? Math.max(0, config.guides.baseline.width) : 0,
	};
}

function toOrderIndices(
	order: readonly string[],
	series: readonly ChartSeriesResolved[],
): readonly number[] {
	return order
		.map((id) => series.findIndex((entry) => id === entry.id))
		.filter((index) => -1 !== index);
}

function toScaleOptions(config: ChartConfigResolved): ChartScaleOptions {
	return {
		axes: config.axes.mode,
		sharedScale: config.axes.shared,
		tickCount: config.axes.tickCount,
	};
}

function toBars(
	stacks: readonly (readonly number[])[],
	slots: readonly ChartSlot[],
	bounds: ScaleBounds,
	options: BarOptions,
): readonly ChartBar[] {
	return stacks.map((stack, index) => toBar(stack, slots[index], bounds, options));
}

/** Bars that touch fill their slot and share its edge; once there is a gap they all match. */
function toBarWidth(slotWidth: number, options: BarOptions): number {
	return 0 === Math.round(options.gap) ? slotWidth : Math.min(slotWidth, Math.round(options.bar));
}

/** Slot edges land on whole pixels, so bars that touch share an edge instead of a seam. */
function toSlot(point: ChartPoint, index: number, size: number): ChartSlot {
	const x = Math.round(index * size);
	const width = Math.round((index + 1) * size) - x;

	return { key: point.key, x, width, center: x + width / 2 };
}

function toBar(
	stack: readonly number[],
	slot: ChartSlot | undefined,
	bounds: ScaleBounds,
	options: BarOptions,
): ChartBar {
	const width = toBarWidth(slot?.width ?? 0, options);

	return {
		key: slot?.key ?? '',
		x: Math.round((slot?.center ?? 0) - width / 2),
		width,
		segments: toSegments(stack, bounds, options),
	};
}

function toSegments(
	stack: readonly number[],
	bounds: ScaleBounds,
	options: BarOptions,
): readonly ChartSegment[] {
	const overlay = 'overlay' === options.stackMode;
	const order = overlay ? 'descending' : options.stackOrder;
	const totals = { up: 0, down: 0 };

	return stackOrderIndices(stack, order)
		.map((index) => {
			const value = stack[index] ?? 0;
			const totalsIndex = 0 <= value ? 'up' : 'down';
			const base = overlay ? 0 : totals[totalsIndex];
			const top = base + value;

			if (!overlay) {
				totals[totalsIndex] = top;
			}

			return toSegment(index, [base, top], bounds, options);
		})
		.filter((segment) => 0 < segment.height);
}

function toSegment(
	index: number,
	span: readonly [number, number],
	bounds: ScaleBounds,
	options: BarOptions,
): ChartSegment {
	const [base, top] = span;
	const from = Math.round(toChartY(base, bounds, options.height));
	const to = Math.round(toChartY(top, bounds, options.height));
	const edges = clearBaseline(
		{ start: Math.min(from, to), end: Math.max(from, to) },
		base <= top,
		bounds,
		options,
	);

	return { index, y: edges.start, height: Math.max(0, edges.end - edges.start) };
}

/** The baseline is a stroke centred on the zero, so a bar stops where that band starts. */
function clearBaseline(
	edges: SegmentEdges,
	above: boolean,
	bounds: ScaleBounds,
	options: BarOptions,
): SegmentEdges {
	if (0 <= bounds.min || 0 === options.baselineWidth) {
		return edges;
	}

	const zeroY = toChartY(0, bounds, options.height);
	const half = options.baselineWidth / 2;

	return above
		? { start: edges.start, end: Math.min(edges.end, Math.floor(zeroY - half)) }
		: { start: Math.max(edges.start, Math.ceil(zeroY + half)), end: edges.end };
}

function stackOrderIndices(stack: readonly number[], order: StackOrder): readonly number[] {
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
	series: readonly ChartSeriesResolved[],
	slots: readonly ChartSlot[],
	bounds: ScaleBounds,
	height: number,
): readonly ChartLine[] {
	return series.map((entry, index) => {
		const vertices = slots.map((slot, slotIndex) => ({
			x: slot.center,
			y: toChartY(seriesValue(entry, slotIndex), bounds, height),
		}));

		return {
			index,
			path: toPath(vertices, entry.line.curve),
			width: entry.line.width,
			dash: entry.line.dash,
		};
	});
}

function barBounds(stacks: readonly (readonly number[])[], mode: ChartStackMode): ScaleBounds {
	const totals =
		'overlay' === mode
			? stacks.flat()
			: stacks.flatMap((stack) => [sumSigned(stack, 1), sumSigned(stack, -1)]);

	return toBounds(totals);
}

function lineBounds(visible: VisibleData): ScaleBounds {
	return toBounds(
		visible.lines.flatMap((series) =>
			visible.points.map((_unused, index) => seriesValue(series, index)),
		),
	);
}

function toBounds(values: readonly number[]): ScaleBounds {
	return { min: Math.min(0, ...values), max: Math.max(0, ...values) };
}

function sumSigned(values: readonly number[], sign: number): number {
	return values.filter((value) => 0 <= sign * value).reduce((total, value) => total + value, 0);
}

import { fitSlots } from '@app/util/fit-slots';
import { linearScale } from '@app/util/scale';

const LABEL_MIN_WIDTH = 28;
const DEFAULT_BAR_RATIO = 0.68;

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
}

export interface ChartGeometry {
	readonly points: readonly ChartPoint[];
	readonly slots: readonly ChartSlot[];
	readonly bars: readonly ChartBar[];
	readonly lines: readonly ChartLine[];
	readonly barMax: number;
	readonly lineMax: number;
	readonly labelStep: number;
}

export interface ChartGeometryOptions {
	readonly width: number;
	readonly height: number;
	readonly minSlot: number;
	readonly barRatio?: number;
}

const EMPTY: ChartGeometry = {
	points: [],
	slots: [],
	bars: [],
	lines: [],
	barMax: 0,
	lineMax: 0,
	labelStep: 1,
};

/** The newest point owns the right edge: whatever does not fit drops off the left. */
export function buildChartGeometry(
	points: readonly ChartPoint[],
	options: ChartGeometryOptions,
): ChartGeometry {
	const fit = fitSlots(options.width, options.minSlot, points.length, 'stretch');

	if (0 === fit.count) {
		return EMPTY;
	}

	const visible = points.slice(points.length - fit.count);
	const barMax = maxStack(visible);
	const lineMax = maxLine(visible);
	const slots = visible.map((point, index) => toSlot(point, index, fit.size));

	return {
		points: visible,
		slots,
		bars: visible.map((point, index) => toBar(point, slots[index], barMax, options)),
		lines: toLines(visible, slots, lineMax, options.height),
		barMax,
		lineMax,
		labelStep: Math.max(1, Math.ceil(LABEL_MIN_WIDTH / fit.size)),
	};
}

function toSlot(point: ChartPoint, index: number, size: number): ChartSlot {
	const x = index * size;

	return { key: point.key, x, width: size, center: x + size / 2 };
}

function toBar(
	point: ChartPoint,
	slot: ChartSlot | undefined,
	barMax: number,
	options: ChartGeometryOptions,
): ChartBar {
	const width = (slot?.width ?? 0) * (options.barRatio ?? DEFAULT_BAR_RATIO);
	let offset = 0;

	const segments = point.stack.map((value, index) => {
		const height = scaleTo(value, barMax, options.height);

		offset += height;

		return { index, y: options.height - offset, height };
	});

	return {
		key: point.key,
		x: (slot?.x ?? 0) + ((slot?.width ?? 0) - width) / 2,
		width,
		segments: segments.filter((segment) => 0 < segment.height),
	};
}

function toLines(
	points: readonly ChartPoint[],
	slots: readonly ChartSlot[],
	lineMax: number,
	height: number,
): readonly ChartLine[] {
	const count = Math.max(0, ...points.map((point) => point.lines.length));

	return Array.from({ length: count }, (_unused, index) => ({
		index,
		path: points
			.map((point, slotIndex) => {
				const x = slots[slotIndex]?.center ?? 0;
				const y = height - scaleTo(point.lines[index] ?? 0, lineMax, height);

				return `${x.toFixed(2)},${y.toFixed(2)}`;
			})
			.join(' '),
	}));
}

function scaleTo(value: number, max: number, height: number): number {
	return 0 >= max ? 0 : linearScale(value, { min: 0, max }, height);
}

function maxStack(points: readonly ChartPoint[]): number {
	return Math.max(0, ...points.map((point) => sum(point.stack)));
}

function maxLine(points: readonly ChartPoint[]): number {
	return Math.max(0, ...points.flatMap((point) => [...point.lines]));
}

function sum(values: readonly number[]): number {
	return values.reduce((total, value) => total + value, 0);
}

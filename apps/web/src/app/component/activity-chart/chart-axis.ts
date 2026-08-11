import { NiceScale, ScaleBounds, linearScale, niceScale, scaleTicks } from '@app/util/scale';

export type ChartAxes = 'none' | 'bars' | 'lines' | 'both';
export type ChartAxisSide = 'start' | 'end';

export interface ChartAxisSides {
	readonly start: boolean;
	readonly end: boolean;
}

export interface ChartTick {
	readonly value: number;
	readonly y: number;
}

export interface ChartAxis {
	readonly side: ChartAxisSide;
	readonly ticks: readonly ChartTick[];
}

export interface ChartScales {
	readonly bar: NiceScale;
	readonly line: NiceScale;
}

export interface ChartScaleOptions {
	readonly axes: ChartAxes;
	readonly sharedScale: boolean;
	readonly tickCount: number;
}

export function axisSides(axes: ChartAxes, sharedScale: boolean): ChartAxisSides {
	if ('none' === axes) {
		return { start: false, end: false };
	}

	if (sharedScale) {
		return { start: true, end: false };
	}

	return {
		start: 'bars' === axes || 'both' === axes,
		end: 'lines' === axes || 'both' === axes,
	};
}

export function resolveScales(
	bar: ScaleBounds,
	line: ScaleBounds,
	options: ChartScaleOptions,
): ChartScales {
	const sides = axisSides(options.axes, options.sharedScale);

	if (options.sharedScale) {
		const shared = mergeBounds(bar, line);
		const scaled = sides.start ? niceScale(shared, options.tickCount) : rawScale(shared);

		return { bar: scaled, line: scaled };
	}

	return {
		bar: sides.start ? niceScale(bar, options.tickCount) : rawScale(bar),
		line: sides.end ? niceScale(line, options.tickCount) : rawScale(line),
	};
}

export function toChartY(value: number, bounds: ScaleBounds, height: number): number {
	return bounds.max === bounds.min ? height : height - linearScale(value, bounds, height);
}

export function mergeBounds(left: ScaleBounds, right: ScaleBounds): ScaleBounds {
	return { min: Math.min(left.min, right.min), max: Math.max(left.max, right.max) };
}

export function buildAxes(
	scales: ChartScales,
	height: number,
	options: ChartScaleOptions,
): readonly ChartAxis[] {
	const sides = axisSides(options.axes, options.sharedScale);
	const axes: ChartAxis[] = [];

	if (sides.start) {
		axes.push({ side: 'start', ticks: toTicks(scales.bar, height) });
	}

	if (sides.end) {
		axes.push({ side: 'end', ticks: toTicks(scales.line, height) });
	}

	return axes;
}

function toTicks(scale: NiceScale, height: number): readonly ChartTick[] {
	return scaleTicks(scale).map((value) => ({ value, y: toChartY(value, scale, height) }));
}

function rawScale(bounds: ScaleBounds): NiceScale {
	return { ...bounds, step: 0 };
}

import { linearScale, niceMax, niceTicks } from '@app/util/scale';

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
	readonly barMax: number;
	readonly lineMax: number;
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
	barMax: number,
	lineMax: number,
	options: ChartScaleOptions,
): ChartScales {
	const sides = axisSides(options.axes, options.sharedScale);

	if (options.sharedScale) {
		const shared = Math.max(barMax, lineMax);
		const scaled = sides.start ? niceMax(shared, options.tickCount) : shared;

		return { barMax: scaled, lineMax: scaled };
	}

	return {
		barMax: sides.start ? niceMax(barMax, options.tickCount) : barMax,
		lineMax: sides.end ? niceMax(lineMax, options.tickCount) : lineMax,
	};
}

export function buildAxes(
	scales: ChartScales,
	height: number,
	options: ChartScaleOptions,
): readonly ChartAxis[] {
	const sides = axisSides(options.axes, options.sharedScale);
	const axes: ChartAxis[] = [];

	if (sides.start) {
		axes.push({ side: 'start', ticks: toTicks(scales.barMax, height, options.tickCount) });
	}

	if (sides.end) {
		axes.push({ side: 'end', ticks: toTicks(scales.lineMax, height, options.tickCount) });
	}

	return axes;
}

function toTicks(max: number, height: number, count: number): readonly ChartTick[] {
	if (0 >= max) {
		return [{ value: 0, y: height }];
	}

	return niceTicks(max, count).map((value) => ({
		value,
		y: height - linearScale(value, { min: 0, max }, height),
	}));
}

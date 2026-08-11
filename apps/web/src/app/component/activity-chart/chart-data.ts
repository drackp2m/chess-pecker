export type ChartSeriesType = 'bar' | 'line';
export type ChartLineCurve = 'linear' | 'smooth';

export const DEFAULT_BAR_COLORS: readonly string[] = [
	'var(--chart-bar-1)',
	'var(--chart-bar-2)',
	'var(--chart-bar-3)',
];

export const DEFAULT_LINE_COLORS: readonly string[] = [
	'var(--chart-line-1)',
	'var(--chart-line-2)',
];

export interface ChartLineStyle {
	readonly curve?: ChartLineCurve;
	readonly width?: number;
	readonly dash?: string | null;
}

export type ChartLineStyleResolved = Required<ChartLineStyle>;

export const DEFAULT_LINE_STYLE: ChartLineStyleResolved = {
	curve: 'linear',
	width: 1.5,
	dash: null,
};

export interface ChartPoint {
	readonly key: string;
	readonly label: string;
	readonly description?: string;
}

export interface ChartSeries {
	readonly id: string;
	readonly label: string;
	readonly values: readonly number[];
	readonly type?: ChartSeriesType;
	readonly color?: string;
	readonly line?: ChartLineStyle;
}

export interface ChartData {
	readonly points: readonly ChartPoint[];
	readonly series: readonly ChartSeries[];
}

export interface ChartSeriesResolved {
	readonly id: string;
	readonly label: string;
	readonly values: readonly number[];
	readonly color: string;
	readonly line: ChartLineStyleResolved;
}

export const EMPTY_CHART_DATA: ChartData = { points: [], series: [] };

export function resolveLineStyle(style: ChartLineStyle | undefined): ChartLineStyleResolved {
	return { ...DEFAULT_LINE_STYLE, ...style };
}

export function toBarSeries(data: ChartData): readonly ChartSeriesResolved[] {
	return resolveSeries(
		data.series.filter((series) => 'line' !== series.type),
		DEFAULT_BAR_COLORS,
	);
}

export function toLineSeries(data: ChartData): readonly ChartSeriesResolved[] {
	return resolveSeries(
		data.series.filter((series) => 'line' === series.type),
		DEFAULT_LINE_COLORS,
	);
}

export function seriesValue(series: ChartSeriesResolved, index: number): number {
	return series.values[index] ?? 0;
}

function resolveSeries(
	series: readonly ChartSeries[],
	palette: readonly string[],
): readonly ChartSeriesResolved[] {
	return series.map((entry, index) => ({
		id: entry.id,
		label: entry.label,
		values: entry.values,
		color: entry.color ?? paletteColor(palette, index),
		line: resolveLineStyle(entry.line),
	}));
}

function paletteColor(palette: readonly string[], index: number): string {
	return palette[index % palette.length] ?? 'currentcolor';
}

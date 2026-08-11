import { ChartAxes } from '@app/component/activity-chart/chart-axis';

export type ChartDirection = 'ltr' | 'rtl';
export type ChartStackMode = 'stacked' | 'overlay';
export type ChartStackOrder = 'input' | 'ascending' | 'descending' | readonly string[];
export type ChartBarGrow = 'none' | 'bar' | 'gap' | 'both';
export type ChartBarShrink = 'none' | 'bar' | 'gap' | 'both';
export type ChartBarCount = number | 'auto';
export type ChartOverflowMode = 'drop' | 'scroll';
export type ChartAxisWidth = number | 'auto';
export type ChartLabelStep = number | 'auto';
export type ChartBaseline = boolean | { readonly width: number };

export interface ChartLayoutSettings {
	readonly height: number;
	readonly direction: ChartDirection;
}

export interface ChartBarSettings {
	readonly width: number;
	readonly gap: number;
	readonly count: ChartBarCount;
	readonly pad: boolean;
	readonly grow: ChartBarGrow;
	readonly shrink: ChartBarShrink;
	readonly stack: ChartStackMode;
	readonly order: ChartStackOrder;
}

export interface ChartOverflowSettings {
	readonly mode: ChartOverflowMode;
	readonly maxDropRatio: number;
}

export interface ChartAxisSettings {
	readonly mode: ChartAxes;
	readonly shared: boolean;
	readonly tickCount: number;
	readonly width: ChartAxisWidth;
	readonly format: (value: number) => string;
}

export interface ChartBaselineSettings {
	readonly show: boolean;
	readonly width: number;
}

export interface ChartGuideSettings {
	readonly grid: boolean;
	readonly baseline: ChartBaselineSettings;
}

export interface ChartLabelSettings {
	readonly show: boolean;
	readonly step: ChartLabelStep;
}

export interface ChartConfigResolved {
	readonly layout: ChartLayoutSettings;
	readonly bars: ChartBarSettings;
	readonly axes: ChartAxisSettings;
	readonly guides: ChartGuideSettings;
	readonly labels: ChartLabelSettings;
	readonly legend: { readonly show: boolean };
	readonly interaction: { readonly enabled: boolean };
	readonly overflow: ChartOverflowSettings;
}

export interface ChartConfig {
	readonly layout?: Partial<ChartLayoutSettings>;
	readonly bars?: Partial<ChartBarSettings>;
	readonly axes?: Partial<ChartAxisSettings>;
	readonly guides?: { readonly grid?: boolean; readonly baseline?: ChartBaseline };
	readonly labels?: Partial<ChartLabelSettings>;
	readonly legend?: { readonly show?: boolean };
	readonly interaction?: { readonly enabled?: boolean };
	readonly overflow?: Partial<ChartOverflowSettings>;
}

export const DEFAULT_CHART_CONFIG: ChartConfigResolved = {
	layout: { height: 160, direction: 'ltr' },
	bars: {
		width: 12,
		gap: 6,
		count: 'auto',
		pad: false,
		grow: 'both',
		shrink: 'none',
		stack: 'stacked',
		order: 'input',
	},
	axes: {
		mode: 'bars',
		shared: true,
		tickCount: 4,
		width: 'auto',
		format: (value) => value.toString(),
	},
	guides: { grid: true, baseline: { show: true, width: 1 } },
	labels: { show: true, step: 'auto' },
	legend: { show: true },
	interaction: { enabled: true },
	overflow: { mode: 'drop', maxDropRatio: 1 },
};

export function resolveChartConfig(config: ChartConfig | undefined): ChartConfigResolved {
	return {
		layout: { ...DEFAULT_CHART_CONFIG.layout, ...config?.layout },
		bars: { ...DEFAULT_CHART_CONFIG.bars, ...config?.bars },
		axes: { ...DEFAULT_CHART_CONFIG.axes, ...config?.axes },
		guides: {
			...DEFAULT_CHART_CONFIG.guides,
			...config?.guides,
			baseline: resolveBaseline(config?.guides?.baseline),
		},
		labels: { ...DEFAULT_CHART_CONFIG.labels, ...config?.labels },
		legend: { ...DEFAULT_CHART_CONFIG.legend, ...config?.legend },
		interaction: { ...DEFAULT_CHART_CONFIG.interaction, ...config?.interaction },
		overflow: { ...DEFAULT_CHART_CONFIG.overflow, ...config?.overflow },
	};
}

function resolveBaseline(baseline: ChartBaseline | undefined): ChartBaselineSettings {
	const fallback = DEFAULT_CHART_CONFIG.guides.baseline;

	if (undefined === baseline) {
		return fallback;
	}

	return 'boolean' === typeof baseline
		? { ...fallback, show: baseline }
		: { show: true, width: Math.max(0, baseline.width) };
}

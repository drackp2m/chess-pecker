import {
	Component,
	ElementRef,
	afterRenderEffect,
	computed,
	input,
	linkedSignal,
	output,
	signal,
	viewChild,
	viewChildren,
} from '@angular/core';

import { ChartAxis, ChartAxisSide, axisSides } from '@app/component/activity-chart/chart-axis';
import { ChartConfig, resolveChartConfig } from '@app/component/activity-chart/chart-config';
import {
	ChartData,
	ChartPoint,
	ChartSeriesResolved,
	seriesValue,
	toBarSeries,
	toLineSeries,
} from '@app/component/activity-chart/chart-data';
import { buildChartGeometry } from '@app/component/activity-chart/chart-geometry';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { hostWidth } from '@app/util/element-size';
import {
	RovingGridSize,
	RovingPosition,
	lastRovingPosition,
	moveRovingFocus,
	rovingIndex,
} from '@app/util/roving-focus';

const DEFAULT_AXIS_WIDTH = 36;
const LEGEND_STROKE_WIDTH = 24;
const LEGEND_STROKE_HEIGHT = 8;
const LEGEND_DASH_CYCLES = 2;

interface LegendLine {
	readonly label: string;
	readonly color: string;
	readonly width: number;
	readonly dash: string | null;
}

const MIRRORED_KEYS: Record<string, string> = {
	ArrowLeft: 'ArrowRight',
	ArrowRight: 'ArrowLeft',
};

@Component({
	selector: 'app-activity-chart',
	templateUrl: './activity-chart.component.html',
	styleUrl: './activity-chart.component.scss',
	imports: [I18nPipe],
	host: {
		'[style.--chart-axis-start]': 'startAxisPx()',
		'[style.--chart-axis-end]': 'endAxisPx()',
	},
})
export class ActivityChartComponent {
	readonly data = input.required<ChartData>();
	readonly config = input<ChartConfig>({});

	readonly pointFocus = output<ChartPoint | null>();

	protected readonly plotWidth = hostWidth();

	protected readonly settings = computed(() => resolveChartConfig(this.config()));
	protected readonly barSeries = computed(() => toBarSeries(this.data()));
	protected readonly lineSeries = computed(() => toLineSeries(this.data()));

	protected readonly geometry = computed(() =>
		buildChartGeometry(this.data(), this.settings(), this.plotWidth()),
	);

	private readonly sides = computed(() =>
		axisSides(this.settings().axes.mode, this.settings().axes.shared),
	);

	private readonly axisElements = viewChildren<ElementRef<HTMLElement>>('axisElement');
	private readonly measured = signal<Record<ChartAxisSide, number>>({
		start: DEFAULT_AXIS_WIDTH,
		end: DEFAULT_AXIS_WIDTH,
	});

	protected readonly startAxisPx = computed(() => this.gutter('start', this.sides().start));
	protected readonly endAxisPx = computed(() => this.gutter('end', this.sides().end));

	protected readonly scrolls = computed(() => null !== this.geometry().viewport);

	/** The snap stops sit side by side, so they follow the plot and not the reading order. */
	protected readonly snapSlots = computed(() =>
		[...this.geometry().slots].sort((left, right) => left.x - right.x),
	);

	protected readonly issueMessage = computed(() =>
		'too-many-points' === this.geometry().issue
			? I18n.common.CHART_TOO_MANY_POINTS
			: I18n.common.CHART_BARS_DO_NOT_FIT,
	);

	protected readonly legendWidth = LEGEND_STROKE_WIDTH;
	protected readonly legendHeight = LEGEND_STROKE_HEIGHT;
	protected readonly legendCenter = LEGEND_STROKE_HEIGHT / 2;

	protected readonly legendLines = computed<readonly LegendLine[]>(() =>
		this.lineSeries().map((series) => ({
			label: series.label,
			color: series.color,
			width: Math.min(series.line.width, LEGEND_STROKE_HEIGHT),
			dash: legendDash(series.line.dash),
		})),
	);

	protected readonly gridTicks = computed(() =>
		this.settings().guides.grid ? (this.axis('start')?.ticks ?? []) : [],
	);

	protected readonly baselineY = computed(() => {
		const { points, zeroY } = this.geometry();
		const shown = this.settings().guides.baseline.show && zeroY < this.settings().layout.height;

		return 0 < points.length && shown ? zeroY : null;
	});

	protected readonly gridSize = computed<RovingGridSize>(() => ({
		columns: this.geometry().points.length,
		rows: 1,
	}));

	/** One tab stop for the whole plot, the same way the heatmap holds one for the year. */
	protected readonly activePosition = linkedSignal<RovingGridSize, RovingPosition | null>({
		source: () => this.gridSize(),
		computation: (size, previous) => {
			const current = previous?.value ?? null;

			return null !== current && current.column < size.columns
				? current
				: lastRovingPosition(size, () => true);
		},
	});

	private readonly slots = viewChildren<ElementRef<HTMLElement>>('slot');
	private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

	constructor() {
		afterRenderEffect(() => {
			this.measureAxes();
		});

		afterRenderEffect({
			write: () => {
				this.pinScroll();
			},
		});
	}

	axis(side: ChartAxisSide): ChartAxis | undefined {
		return this.geometry().axes.find((axis) => side === axis.side);
	}

	formatTick(value: number): string {
		return this.settings().axes.format(value);
	}

	barColor(index: number): string {
		return this.barSeries()[index]?.color ?? '';
	}

	lineColor(index: number): string {
		return this.lineSeries()[index]?.color ?? '';
	}

	describe(point: ChartPoint, column: number): string {
		return point.description ?? this.compose(point, column);
	}

	isActive(column: number): boolean {
		return this.activePosition()?.column === column;
	}

	showsLabel(column: number): boolean {
		return 0 === column % this.geometry().labelStep;
	}

	onFocus(point: ChartPoint | null): void {
		this.pointFocus.emit(point);
	}

	onSlotFocus(point: ChartPoint, column: number): void {
		this.activePosition.set({ column, row: 0 });
		this.onFocus(point);
	}

	onKeydown(event: KeyboardEvent, column: number): void {
		const size = this.gridSize();
		const rtl = 'rtl' === this.settings().layout.direction;
		const key = rtl ? (MIRRORED_KEYS[event.key] ?? event.key) : event.key;
		const next = moveRovingFocus(key, { column, row: 0 }, size, () => true);

		if (null === next) {
			return;
		}

		event.preventDefault();
		this.activePosition.set(next);
		this.slots()[rovingIndex(next, size)]?.nativeElement.focus();
	}

	private compose(point: ChartPoint, column: number): string {
		const series = [...this.barSeries(), ...this.lineSeries()];
		const values = series.map((entry) => this.valueLabel(entry, column));

		return [point.label, ...values].join(' · ');
	}

	private valueLabel(series: ChartSeriesResolved, column: number): string {
		return `${series.label} ${seriesValue(series, column).toString()}`;
	}

	private gutter(side: ChartAxisSide, shown: boolean): string {
		if (!shown) {
			return '0px';
		}

		const width = this.settings().axes.width;

		return `${('auto' === width ? this.measured()[side] : width).toString()}px`;
	}

	/**
	 * A plot read backwards opens on its first point, the way the heatmap opens on today. The
	 * strip is re-pinned whenever it is re-measured — the axis gutters land after the first
	 * paint, and a viewport that moves under a scroll left where it was hides the opening point.
	 */
	private pinScroll(): void {
		const element = this.scroller()?.nativeElement;
		const { width, viewport } = this.geometry();

		if (undefined === element || null === viewport || 0 === width) {
			return;
		}

		element.scrollLeft = 'rtl' === this.settings().layout.direction ? element.scrollWidth : 0;
	}

	private measureAxes(): void {
		const elements = this.axisElements();
		const widths: Record<ChartAxisSide, number> = { start: 0, end: 0 };

		this.geometry().axes.forEach((axis, index) => {
			widths[axis.side] = tickWidth(elements[index]?.nativeElement);
		});

		this.measured.update((previous) =>
			previous.start === widths.start && previous.end === widths.end ? previous : widths,
		);
	}
}

function legendDash(dash: string | null): string | null {
	if (null === dash) {
		return null;
	}

	const pattern = dash
		.split(/[\s,]+/)
		.map(Number)
		.filter((value) => Number.isFinite(value) && 0 <= value);

	if (0 === pattern.length) {
		return null;
	}

	const total = pattern.reduce((sum, value) => sum + value, 0);
	const period = 1 === pattern.length ? total * 2 : total;
	const scale = Math.min(1, LEGEND_STROKE_WIDTH / (LEGEND_DASH_CYCLES * period));

	return pattern.map((value) => Math.round(value * scale * 100) / 100).join(' ');
}

function tickWidth(axis: HTMLElement | undefined): number {
	const ticks = Array.from(axis?.children ?? []).filter((tick) => tick instanceof HTMLElement);

	return Math.ceil(Math.max(0, ...ticks.map((tick) => tick.offsetWidth)));
}

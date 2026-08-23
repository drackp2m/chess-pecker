import {
	Component,
	DOCUMENT,
	ElementRef,
	afterRenderEffect,
	computed,
	inject,
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
import { ChartGeometry, buildChartGeometry } from '@app/component/activity-chart/chart-geometry';
import { TouchScrubDirective } from '@app/directive/touch-scrub.directive';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { hostBorderWidth } from '@app/util/element-size';
import {
	RovingGridSize,
	RovingPosition,
	lastRovingPosition,
	moveRovingFocus,
	rovingIndex,
} from '@app/util/roving-focus';

const DEFAULT_AXIS_WIDTH = 36;
const LABEL_GAP = 6;
const MAX_MEASURE_PASSES = 4;
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
	imports: [I18nPipe, TouchScrubDirective],
	host: {
		'[class.is-loading]': '!ready()',
		'[style.--chart-axis-start]': 'startAxisPx()',
		'[style.--chart-axis-end]': 'endAxisPx()',
	},
})
export class ActivityChartComponent {
	protected readonly I18n = I18n;

	readonly data = input.required<ChartData>();
	readonly config = input<ChartConfig>({});

	readonly pointFocus = output<ChartPoint | null>();

	private readonly document = inject(DOCUMENT);
	private readonly hostBox = hostBorderWidth();

	protected readonly settings = computed(() => resolveChartConfig(this.config()));
	protected readonly barSeries = computed(() => toBarSeries(this.data()));
	protected readonly lineSeries = computed(() => toLineSeries(this.data()));

	private readonly labelSpace = signal(0);

	private readonly sides = computed(() =>
		axisSides(this.settings().axes.mode, this.settings().axes.shared),
	);

	private readonly axisElements = viewChildren<ElementRef<HTMLElement>>('axisElement');
	private readonly labelElements = viewChildren<ElementRef<HTMLElement>>('labelElement');
	private readonly measured = signal<Record<ChartAxisSide, number>>({
		start: DEFAULT_AXIS_WIDTH,
		end: DEFAULT_AXIS_WIDTH,
	});

	private readonly startGutter = computed(() => this.gutter('start', this.sides().start));
	private readonly endGutter = computed(() => this.gutter('end', this.sides().end));

	protected readonly startAxisPx = computed(() => `${this.startGutter().toString()}px`);
	protected readonly endAxisPx = computed(() => `${this.endGutter().toString()}px`);

	/**
	 * The plot takes the border box less the gutters, not the content box the browser hands
	 * back a layout later, so the geometry is never a paint behind.
	 */
	private readonly plotWidth = computed(() =>
		Math.max(0, this.hostBox() - this.startGutter() - this.endGutter()),
	);

	protected readonly geometry = computed(() =>
		buildChartGeometry(this.data(), this.settings(), this.plotWidth(), this.labelSpace()),
	);

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

	private readonly hoveredColumn = signal<number | null>(null);

	private readonly pinnedColumn = linkedSignal<RovingGridSize, number | null>({
		source: () => this.gridSize(),
		computation: () => null,
	});

	private readonly highlightedColumn = computed(() => this.hoveredColumn() ?? this.pinnedColumn());

	private readonly highlightedPoint = computed(() => {
		const column = this.highlightedColumn();

		return null === column ? null : (this.geometry().points[column] ?? null);
	});

	private readonly settledGeometry = signal<ChartGeometry | null>(null);

	protected readonly ready = computed(
		() => 0 < this.plotWidth() && this.settledGeometry() === this.geometry(),
	);

	protected readonly showsLoading = computed(
		() => !this.ready() && null === this.settledGeometry(),
	);

	private emitted: ChartPoint | null = null;

	private readonly slots = viewChildren<ElementRef<HTMLElement>>('slot');
	private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

	private passes = 0;

	constructor() {
		this.watchFontSwap();

		afterRenderEffect(() => {
			this.measurePlot();
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

	isHighlighted(column: number): boolean {
		return this.highlightedColumn() === column;
	}

	showsLabel(column: number): boolean {
		return 0 === column % this.geometry().labelStep;
	}

	onHover(column: number): void {
		this.hoveredColumn.set(column);
		this.emitHighlight();
	}

	onLeave(column: number): void {
		if (this.hoveredColumn() === column) {
			this.hoveredColumn.set(null);
			this.emitHighlight();
		}
	}

	onScrub(target: HTMLElement | null): void {
		this.hoveredColumn.set(this.columnOf(target));
		this.emitHighlight();
	}

	onPin(target: HTMLElement | null): void {
		this.pinnedColumn.set(this.columnOf(target));
		this.emitHighlight();
	}

	onSlotFocus(column: number): void {
		this.activePosition.set({ column, row: 0 });
		this.onHover(column);
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

	private emitHighlight(): void {
		const point = this.highlightedPoint();

		if (point === this.emitted) {
			return;
		}

		this.emitted = point;
		this.pointFocus.emit(point);
	}

	private columnOf(target: HTMLElement | null): number | null {
		const column =
			null === target ? -1 : this.slots().findIndex((slot) => target === slot.nativeElement);

		return undefined === this.geometry().points[column] ? null : column;
	}

	private compose(point: ChartPoint, column: number): string {
		const series = [...this.barSeries(), ...this.lineSeries()];
		const values = series.map((entry) => this.valueLabel(entry, column));

		return [point.label, ...values].join(' · ');
	}

	private valueLabel(series: ChartSeriesResolved, column: number): string {
		return `${series.label} ${seriesValue(series, column).toString()}`;
	}

	private gutter(side: ChartAxisSide, shown: boolean): number {
		if (!shown) {
			return 0;
		}

		const width = this.settings().axes.width;

		return 'auto' === width ? this.measured()[side] : width;
	}

	/**
	 * A plot read backwards opens on its first point. It is re-pinned on every measurement:
	 * a viewport moving under a stale scroll would hide that point.
	 */
	private pinScroll(): void {
		const element = this.scroller()?.nativeElement;
		const { width, viewport } = this.geometry();

		if (undefined === element || null === viewport || 0 === width) {
			return;
		}

		element.scrollLeft = 'rtl' === this.settings().layout.direction ? element.scrollWidth : 0;
	}

	/**
	 * Only the browser can size text, so the pass re-reads the ticks and labels and reopens the
	 * loop until they match what the geometry assumed. Only a survivor is painted.
	 */
	private measurePlot(): void {
		if (0 === this.plotWidth() || this.awaitsView()) {
			return;
		}

		const gutters = this.readGutters();
		const label = this.readLabelSpace();
		const settled = this.matches(gutters, label);
		const exhausted = MAX_MEASURE_PASSES <= this.passes;

		this.passes = settled || exhausted ? 0 : this.passes + 1;

		if (settled || exhausted) {
			this.settledGeometry.set(this.geometry());

			return;
		}

		this.measured.set(gutters);
		this.labelSpace.set(label);
	}

	/**
	 * A font that swaps in after the plot settled moves the very text the gutters were cut to
	 * fit, and nothing about the layout announces it, so the loop is reopened by hand.
	 */
	private watchFontSwap(): void {
		void this.document.fonts.ready.then(() => {
			this.passes = 0;
			this.measured.set({ ...this.measured() });
		});
	}

	/** A pass that runs on a view the geometry has outgrown would measure the wrong text. */
	private awaitsView(): boolean {
		const { axes, points } = this.geometry();
		const labelled = this.settings().labels.show && 0 < points.length;

		return (
			this.axisElements().length !== axes.length ||
			(labelled && this.labelElements().length !== points.length)
		);
	}

	private matches(gutters: Record<ChartAxisSide, number>, label: number): boolean {
		const previous = this.measured();

		return (
			previous.start === gutters.start &&
			previous.end === gutters.end &&
			this.labelSpace() === label
		);
	}

	private readGutters(): Record<ChartAxisSide, number> {
		const elements = this.axisElements();
		const widths: Record<ChartAxisSide, number> = { start: 0, end: 0 };

		this.geometry().axes.forEach((axis, index) => {
			widths[axis.side] = tickWidth(elements[index]?.nativeElement);
		});

		return widths;
	}

	private readLabelSpace(): number {
		const widths = this.labelElements().map(
			(element) => element.nativeElement.getBoundingClientRect().width,
		);

		return 0 === widths.length ? 0 : Math.ceil(Math.max(...widths)) + LABEL_GAP;
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

	return Math.ceil(Math.max(0, ...ticks.map((tick) => tick.getBoundingClientRect().width)));
}

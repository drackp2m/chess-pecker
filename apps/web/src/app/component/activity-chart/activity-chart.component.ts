import {
	Component,
	ElementRef,
	afterRenderEffect,
	computed,
	input,
	linkedSignal,
	output,
	signal,
	viewChildren,
} from '@angular/core';

import {
	ChartAxes,
	ChartAxis,
	ChartAxisSide,
	axisSides,
} from '@app/component/activity-chart/chart-axis';
import {
	ChartBarSpacing,
	ChartLineStyle,
	ChartLineStyleResolved,
	ChartPoint,
	ChartStackMode,
	ChartStackOrder,
	DEFAULT_BAR_SPACING,
	DEFAULT_MAX_DROP_RATIO,
	DEFAULT_MIN_BAR_WIDTH,
	DEFAULT_TICK_COUNT,
	buildChartGeometry,
	resolveLineStyle,
} from '@app/component/activity-chart/chart-geometry';
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

const DEFAULT_MIN_SLOT = 14;
const DEFAULT_HEIGHT = 160;
const DEFAULT_AXIS_WIDTH = 36;

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
	readonly points = input<readonly ChartPoint[]>([]);
	readonly barLabels = input<readonly string[]>([]);
	readonly lineLabels = input<readonly string[]>([]);
	readonly minSlot = input(DEFAULT_MIN_SLOT);
	readonly height = input(DEFAULT_HEIGHT);
	readonly barSpacing = input<ChartBarSpacing>(DEFAULT_BAR_SPACING);
	readonly minBarWidth = input(DEFAULT_MIN_BAR_WIDTH);
	readonly maxDropRatio = input(DEFAULT_MAX_DROP_RATIO);
	readonly lineStyles = input<readonly ChartLineStyle[]>([]);
	readonly stackMode = input<ChartStackMode>('stacked');
	readonly stackOrder = input<ChartStackOrder>('input');
	readonly axes = input<ChartAxes>('bars');
	readonly sharedScale = input(true);
	readonly tickCount = input(DEFAULT_TICK_COUNT);
	readonly axisWidth = input<number | null>(null);

	readonly pointFocus = output<ChartPoint | null>();

	protected readonly plotWidth = hostWidth();

	private readonly sides = computed(() => axisSides(this.axes(), this.sharedScale()));

	private readonly axisElements = viewChildren<ElementRef<HTMLElement>>('axisElement');
	private readonly measured = signal<Record<ChartAxisSide, number>>({
		start: DEFAULT_AXIS_WIDTH,
		end: DEFAULT_AXIS_WIDTH,
	});

	protected readonly startAxisPx = computed(() => this.gutter('start', this.sides().start));
	protected readonly endAxisPx = computed(() => this.gutter('end', this.sides().end));

	protected readonly geometry = computed(() =>
		buildChartGeometry(this.points(), {
			width: this.plotWidth(),
			height: this.height(),
			minSlot: this.minSlot(),
			barSpacing: this.barSpacing(),
			minBarWidth: this.minBarWidth(),
			maxDropRatio: this.maxDropRatio(),
			lineStyles: this.lineStyles(),
			stackMode: this.stackMode(),
			stackOrder: this.stackOrder(),
			axes: this.axes(),
			sharedScale: this.sharedScale(),
			tickCount: this.tickCount(),
		}),
	);

	protected readonly issueMessage = computed(() =>
		'too-many-points' === this.geometry().issue
			? I18n.common.CHART_TOO_MANY_POINTS
			: I18n.common.CHART_BARS_DO_NOT_FIT,
	);

	protected readonly gridTicks = computed(() => this.axis('start')?.ticks ?? []);

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

	constructor() {
		afterRenderEffect(() => {
			this.measureAxes();
		});
	}

	axis(side: ChartAxisSide): ChartAxis | undefined {
		return this.geometry().axes.find((axis) => side === axis.side);
	}

	lineStyle(index: number): ChartLineStyleResolved {
		return resolveLineStyle(this.lineStyles()[index]);
	}

	isActive(column: number): boolean {
		return this.activePosition()?.column === column;
	}

	showsLabel(column: number): boolean {
		const { points, labelStep } = this.geometry();

		return 0 === (points.length - 1 - column) % labelStep;
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
		const next = moveRovingFocus(event.key, { column, row: 0 }, size, () => true);

		if (null === next) {
			return;
		}

		event.preventDefault();
		this.activePosition.set(next);
		this.slots()[rovingIndex(next, size)]?.nativeElement.focus();
	}

	private gutter(side: ChartAxisSide, shown: boolean): string {
		if (!shown) {
			return '0px';
		}

		return `${(this.axisWidth() ?? this.measured()[side]).toString()}px`;
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

function tickWidth(axis: HTMLElement | undefined): number {
	const ticks = Array.from(axis?.children ?? []).filter((tick) => tick instanceof HTMLElement);

	return Math.ceil(Math.max(0, ...ticks.map((tick) => tick.offsetWidth)));
}

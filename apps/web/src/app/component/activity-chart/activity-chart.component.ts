import {
	Component,
	ElementRef,
	computed,
	input,
	linkedSignal,
	output,
	viewChildren,
} from '@angular/core';

import { ChartPoint, buildChartGeometry } from '@app/component/activity-chart/chart-geometry';
import { hostWidth } from '@app/util/element-size';
import {
	RovingGridSize,
	RovingPosition,
	lastRovingPosition,
	moveRovingFocus,
	rovingIndex,
} from '@app/util/roving-focus';

const DEFAULT_MIN_SLOT = 18;
const DEFAULT_HEIGHT = 160;

@Component({
	selector: 'app-activity-chart',
	templateUrl: './activity-chart.component.html',
	styleUrl: './activity-chart.component.scss',
})
export class ActivityChartComponent {
	readonly points = input<readonly ChartPoint[]>([]);
	readonly barLabels = input<readonly string[]>([]);
	readonly lineLabels = input<readonly string[]>([]);
	readonly minSlot = input(DEFAULT_MIN_SLOT);
	readonly height = input(DEFAULT_HEIGHT);

	readonly pointFocus = output<ChartPoint | null>();

	protected readonly plotWidth = hostWidth();

	protected readonly geometry = computed(() =>
		buildChartGeometry(this.points(), {
			width: this.plotWidth(),
			height: this.height(),
			minSlot: this.minSlot(),
		}),
	);

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
}

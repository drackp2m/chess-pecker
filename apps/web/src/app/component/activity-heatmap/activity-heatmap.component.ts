import {
	Component,
	ElementRef,
	computed,
	inject,
	input,
	linkedSignal,
	output,
	viewChild,
	viewChildren,
} from '@angular/core';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';

import { PinScrollEndDirective } from '@app/directive/pin-scroll-end.directive';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { LanguageService } from '@app/service/language.service';
import {
	ActivityCell,
	DAYS_PER_WEEK,
	buildActivityGrid,
	monthAbbreviations,
	weekdayAbbreviations,
} from '@app/util/activity-grid';
import { elementWidth, hostWidth } from '@app/util/element-size';
import { fitSlots } from '@app/util/fit-slots';
import {
	RovingGridSize,
	RovingPosition,
	lastRovingPosition,
	moveRovingFocus,
	rovingIndex,
} from '@app/util/roving-focus';

const DEFAULT_TOTAL_DAYS = 365;
const DEFAULT_CELL_SIZE = 14;
const LEGEND_LEVELS = [0, 1, 2, 3, 4] as const;

@Component({
	selector: 'app-activity-heatmap',
	templateUrl: './activity-heatmap.component.html',
	styleUrl: './activity-heatmap.component.scss',
	imports: [I18nPipe, PinScrollEndDirective],
	host: {
		'[style.--heatmap-cell]': 'cellSizePx()',
	},
})
export class ActivityHeatmapComponent {
	protected readonly I18n = I18n;
	protected readonly legendLevels = LEGEND_LEVELS;

	readonly days = input<readonly TrainingActivityDay[]>([]);
	readonly totalDays = input(DEFAULT_TOTAL_DAYS);
	readonly cellSize = input(DEFAULT_CELL_SIZE);

	readonly dayFocus = output<ActivityCell | null>();

	private readonly languageService = inject(LanguageService);

	readonly weekColumns = computed<readonly (ActivityCell | null)[][]>(() =>
		buildActivityGrid(this.days(), this.totalDays()),
	);

	readonly monthLabels = computed<readonly (string | null)[]>(() =>
		monthAbbreviations(this.weekColumns(), this.languageService.selectedLanguage()),
	);

	readonly lastMonthIndex = computed(() =>
		this.monthLabels().findLastIndex((label) => null !== label),
	);

	readonly weekdayLabels = computed<readonly (string | null)[]>(() =>
		weekdayAbbreviations(this.languageService.selectedLanguage()),
	);

	protected readonly cellSizePx = computed(() => `${this.cellSize().toString()}px`);

	protected readonly gridSize = computed<RovingGridSize>(() => ({
		columns: this.weekColumns().length,
		rows: DAYS_PER_WEEK,
	}));

	/** Only the one cell holding the roving tab stop is reachable with Tab; the rest need arrows. */
	protected readonly activePosition = linkedSignal<RovingGridSize, RovingPosition | null>({
		source: () => this.gridSize(),
		computation: (size, previous) => {
			const current = previous?.value ?? null;

			return null !== current && this.hasData(current)
				? current
				: lastRovingPosition(size, this.hasData);
		},
	});

	private readonly weekdays = viewChild.required<ElementRef<HTMLElement>>('weekdays');
	private readonly cells = viewChildren<ElementRef<HTMLElement>>('cell');

	private readonly availableWidth = hostWidth();
	private readonly weekdaysWidth = elementWidth(this.weekdays);

	/** The visible area is trimmed to whole squares, so no column is ever half painted. */
	protected readonly visibleWidth = computed<number | null>(() => {
		const fit = fitSlots(
			this.availableWidth() - this.weekdaysWidth(),
			this.cellSize(),
			this.weekColumns().length,
			'fixed',
		);

		return 0 === fit.count ? null : fit.count * fit.size;
	});

	onFocus(cell: ActivityCell | null): void {
		this.dayFocus.emit(cell);
	}

	onCellFocus(cell: ActivityCell | null, position: RovingPosition): void {
		if (null !== cell) {
			this.activePosition.set(position);
		}

		this.onFocus(cell);
	}

	isActive(position: RovingPosition): boolean {
		const active = this.activePosition();

		return null !== active && active.column === position.column && active.row === position.row;
	}

	onKeydown(event: KeyboardEvent, position: RovingPosition): void {
		const next = moveRovingFocus(event.key, position, this.gridSize(), this.hasData);

		if (null === next) {
			return;
		}

		event.preventDefault();
		this.activePosition.set(next);
		this.cells()[rovingIndex(next, this.gridSize())]?.nativeElement.focus();
	}

	private readonly hasData = (position: RovingPosition): boolean =>
		null !== (this.weekColumns()[position.column]?.[position.row] ?? null);
}

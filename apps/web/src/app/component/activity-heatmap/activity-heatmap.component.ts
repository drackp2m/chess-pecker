import {
	Component,
	DestroyRef,
	ElementRef,
	afterNextRender,
	afterRenderEffect,
	computed,
	inject,
	input,
	output,
	viewChild,
	viewChildren,
} from '@angular/core';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';

import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { LanguageService } from '@app/service/language.service';
import {
	ActivityCell,
	buildActivityGrid,
	monthAbbreviations,
	weekdayAbbreviations,
} from '@app/util/activity-grid';

const DEFAULT_TOTAL_DAYS = 365;
const LEGEND_LEVELS = [0, 1, 2, 3, 4] as const;
const CELL_EPSILON = 0.02;

@Component({
	selector: 'app-activity-heatmap',
	templateUrl: './activity-heatmap.component.html',
	styleUrl: './activity-heatmap.component.scss',
	imports: [I18nPipe],
})
export class ActivityHeatmapComponent {
	protected readonly I18n = I18n;
	protected readonly legendLevels = LEGEND_LEVELS;

	readonly days = input<readonly TrainingActivityDay[]>([]);
	readonly totalDays = input(DEFAULT_TOTAL_DAYS);

	readonly dayFocus = output<TrainingActivityDay | null>();

	private readonly languageService = inject(LanguageService);

	readonly weekColumns = computed<readonly (ActivityCell | null)[][]>(() =>
		buildActivityGrid(this.days(), this.totalDays()),
	);

	readonly monthLabels = computed<readonly (string | null)[]>(() =>
		monthAbbreviations(this.weekColumns(), this.languageService.selectedLanguage()),
	);

	readonly columnCount = computed(() => String(this.weekColumns().length));

	readonly lastMonthIndex = computed(() =>
		this.monthLabels().findLastIndex((label) => null !== label),
	);

	readonly weekdayLabels = computed<readonly (string | null)[]>(() =>
		weekdayAbbreviations(this.languageService.selectedLanguage()),
	);

	private readonly layout = viewChild.required<ElementRef<HTMLElement>>('layout');
	private readonly weekdays = viewChild.required<ElementRef<HTMLElement>>('weekdays');
	private readonly scroll = viewChild.required<ElementRef<HTMLElement>>('scroll');
	private readonly weeks = viewChildren<ElementRef<HTMLElement>>('week');

	private readonly destroyRef = inject(DestroyRef);

	constructor() {
		afterRenderEffect({
			write: () => {
				this.weekColumns();

				this.fitToWholeCells();
			},
		});

		afterNextRender(() => {
			const observer = new ResizeObserver(() => {
				this.fitToWholeCells();
			});

			observer.observe(this.layout().nativeElement);

			this.destroyRef.onDestroy(() => {
				observer.disconnect();
			});
		});
	}

	onFocus(cell: ActivityCell | null): void {
		this.dayFocus.emit(cell);
	}

	/** The visible area is trimmed to whole squares, so no column is ever half painted. */
	private fitToWholeCells(): void {
		const cell = this.weeks()[0]?.nativeElement.getBoundingClientRect().width;

		if (undefined === cell || 0 >= cell) {
			return;
		}

		const element = this.scroll().nativeElement;
		const available =
			this.layout().nativeElement.clientWidth - this.weekdays().nativeElement.offsetWidth;
		const columns = Math.max(1, Math.floor(available / cell + CELL_EPSILON));

		element.style.maxWidth = `${(Math.min(columns, this.weekColumns().length) * cell).toFixed(3)}px`;
		element.scrollLeft = element.scrollWidth;
	}
}

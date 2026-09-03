import { Component, computed, effect, inject, signal } from '@angular/core';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';

import { ActivityChartComponent } from '@app/component/activity-chart/activity-chart.component';
import type { ChartConfig } from '@app/component/activity-chart/chart-config';
import type { ChartData, ChartPoint, ChartSeries } from '@app/component/activity-chart/chart-data';
import { ActivityHeatmapComponent } from '@app/component/activity-heatmap/activity-heatmap.component';
import { SegmentedControlComponent } from '@app/component/segmented-control/segmented-control.component';
import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { SegmentDirective } from '@app/directive/segment/segment.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { I18nService } from '@app/service/i18n.service';
import { TimezoneService } from '@app/service/timezone.service';
import { ActivityStore } from '@app/store/activity.store';
import { SessionStore } from '@app/store/session.store';
import { TrainingStore } from '@app/store/training.store';
import {
	ActivityCell,
	activityDaySeries,
	activityRangeDays,
	filterActivityDays,
} from '@app/util/activity-grid';

const ACTIVITY_RANGES = [1, 2, 3, 6, 9, 12] as const;
const DEFAULT_ACTIVITY_MONTHS = 6;
const MAX_ACTIVITY_MONTHS = Math.max(...ACTIVITY_RANGES);
const DAILY_RANGE_DAYS = 14;
const MS_PER_MINUTE = 60_000;

@Component({
	templateUrl: './dashboard.page.html',
	imports: [
		ActivityChartComponent,
		ButtonDirective,
		RouterLinkDirective,
		I18nPipe,
		ActivityHeatmapComponent,
		SegmentedControlComponent,
		SegmentDirective,
	],
	providers: [provideI18nScope('dashboard', 'training')],
})
export class DashboardPage {
	protected readonly I18n = I18n;

	readonly session = inject(SessionStore);
	readonly training = inject(TrainingStore);
	readonly activity = inject(ActivityStore);
	protected readonly timezoneService = inject(TimezoneService);

	readonly hoveredDay = signal<ActivityCell | null>(null);
	readonly hoveredDailyDay = signal<ChartPoint | null>(null);

	readonly activityRanges = ACTIVITY_RANGES;
	readonly activityMonths = signal<number>(DEFAULT_ACTIVITY_MONTHS);

	readonly activityDays = computed(() =>
		activityRangeDays(this.activityMonths(), this.timezoneService.selectedTimezone()),
	);

	readonly visibleActivity = computed(() =>
		filterActivityDays(
			this.activity.days(),
			this.activityDays(),
			this.timezoneService.selectedTimezone(),
		),
	);

	readonly totalActivity = computed(() =>
		this.visibleActivity().reduce((total, day) => total + day.done, 0),
	);

	private readonly i18n = inject(I18nService);

	private readonly dailyBreakdown = computed(() =>
		activityDaySeries(
			this.activity.days(),
			DAILY_RANGE_DAYS,
			this.timezoneService.selectedTimezone(),
		),
	);

	readonly dailyChart = computed<ChartData>(() => {
		const days = [...this.dailyBreakdown()].reverse();

		return {
			points: days.map((day) => this.toDayPoint(day)),
			series: [...this.dailyBars(days), ...this.dailyLines(days)],
		};
	});

	readonly dailyConfig: ChartConfig = {
		layout: { direction: 'rtl' },
		bars: { count: 14, pad: true, grow: 'bar' },
		overflow: { mode: 'drop' },
	};

	readonly dailyFirstTry = computed(() =>
		this.dailyBreakdown().reduce((total, day) => total + day.firstTry, 0),
	);

	private loadedFor = '';

	constructor() {
		// The training is local, so it is asked for whoever is here; the session only decides
		// whether the activity is worth asking the API for. A finished sync pass is the other
		// moment worth reading again: it is what brings down an account's history on log in.
		effect(() => {
			const status = this.session.status();
			const syncedAt = this.training.lastSyncedAt();
			const timeZone = this.timezoneService.selectedTimezone();

			if ('unknown' === status) {
				return;
			}

			const pass = `${status}:${(syncedAt?.getTime() ?? 0).toString()}:${timeZone}`;

			if (pass === this.loadedFor) {
				return;
			}

			this.loadedFor = pass;

			void this.training.load();

			void this.activity.load(activityRangeDays(MAX_ACTIVITY_MONTHS, timeZone));
		});
	}

	onDayFocus(day: ActivityCell | null): void {
		this.hoveredDay.set(day);
	}

	selectActivityRange(months: number): void {
		this.hoveredDay.set(null);
		this.activityMonths.set(months);
	}

	onDailyFocus(point: ChartPoint | null): void {
		this.hoveredDailyDay.set(point);
	}

	private dailyBars(days: readonly TrainingActivityDay[]): readonly ChartSeries[] {
		return [
			{
				id: 'firstTry',
				label: this.i18n.translate(I18n.training.DAILY_SERIES_FIRST_TRY),
				values: days.map((day) => day.firstTry),
			},
			{
				id: 'afterMiss',
				label: this.i18n.translate(I18n.training.DAILY_SERIES_AFTER_MISS),
				values: days.map((day) => day.afterMiss),
			},
			{
				id: 'shown',
				label: this.i18n.translate(I18n.training.DAILY_SERIES_SHOWN),
				values: days.map((day) => day.shown),
			},
		];
	}

	private dailyLines(days: readonly TrainingActivityDay[]): readonly ChartSeries[] {
		return [
			{
				id: 'mistakes',
				type: 'line',
				label: this.i18n.translate(I18n.training.DAILY_SERIES_MISTAKES),
				values: days.map((day) => day.mistakes),
				line: { curve: 'smooth' },
			},
			{
				id: 'hints',
				type: 'line',
				label: this.i18n.translate(I18n.training.DAILY_SERIES_HINTS),
				values: days.map((day) => day.hints),
				line: { curve: 'smooth', dash: '6 4' },
			},
		];
	}

	private toDayPoint(day: TrainingActivityDay): ChartPoint {
		return {
			key: day.date,
			label: Number(day.date.slice(8)).toString(),
			description: this.i18n.translate(I18n.training.DAILY_DAY_DETAIL, {
				date: day.date,
				firstTry: day.firstTry,
				afterMiss: day.afterMiss,
				shown: day.shown,
				mistakes: day.mistakes,
				hints: day.hints,
				minutes: Math.round(day.durationMs / MS_PER_MINUTE),
			}),
		};
	}
}

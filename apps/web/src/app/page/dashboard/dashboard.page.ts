import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ActivityHeatmapComponent } from '@app/component/activity-heatmap/activity-heatmap.component';
import { SegmentedControlComponent } from '@app/component/segmented-control/segmented-control.component';
import type { TranslationRef } from '@app/definition/i18n.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { SegmentDirective } from '@app/directive/segment/segment.directive';
import { I18n, i18nRef, provideI18nScope } from '@app/i18n';
import { toTrainingSummary } from '@app/page/dashboard/training-summary';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { ActivityStore } from '@app/store/activity.store';
import { SessionStore } from '@app/store/session.store';
import { TrainingStore } from '@app/store/training.store';
import { LogOutUseCase } from '@app/use-case/log-out.use-case';
import { ActivityCell, activityRangeDays, filterActivityDays } from '@app/util/activity-grid';

const ACTIVITY_RANGES = [1, 2, 3, 6, 9, 12] as const;
const DEFAULT_ACTIVITY_MONTHS = 6;
const MAX_ACTIVITY_MONTHS = Math.max(...ACTIVITY_RANGES);

@Component({
	templateUrl: './dashboard.page.html',
	styleUrl: './dashboard.page.scss',
	imports: [
		ButtonDirective,
		RouterLinkDirective,
		I18nPipe,
		ActivityHeatmapComponent,
		SegmentedControlComponent,
		SegmentDirective,
	],
	providers: [provideI18nScope('dashboard')],
})
export class DashboardPage {
	protected readonly I18n = I18n;

	readonly session = inject(SessionStore);
	readonly training = inject(TrainingStore);
	readonly activity = inject(ActivityStore);

	readonly summary = computed(() => toTrainingSummary(this.training.progress()));

	readonly hoveredDay = signal<ActivityCell | null>(null);

	readonly activityRanges = ACTIVITY_RANGES;
	readonly activityMonths = signal<number>(DEFAULT_ACTIVITY_MONTHS);

	readonly activityDays = computed(() => activityRangeDays(this.activityMonths()));

	readonly visibleActivity = computed(() =>
		filterActivityDays(this.activity.days(), this.activityDays()),
	);

	readonly totalActivity = computed(() =>
		this.visibleActivity().reduce((total, day) => total + day.count, 0),
	);

	/** What the one button on the training does, so the state is read before it is opened. */
	readonly trainingLabel = computed<TranslationRef>(() => {
		const runningCycle = this.training.runningCycle();

		if ('calibrating' === this.training.active()?.status) {
			return i18nRef(I18n.dashboard.TRAINING_REFINE);
		}

		return undefined === runningCycle
			? i18nRef(I18n.dashboard.TRAINING_CONTINUE)
			: i18nRef(I18n.dashboard.CYCLE_CONTINUE, { index: runningCycle.index });
	});

	/** Anything already in progress goes straight to the board; the rest needs the forms. */
	private readonly trainingLink = computed(() =>
		'calibrating' === this.training.active()?.status || undefined !== this.training.runningCycle()
			? '/training/solve'
			: '/training',
	);

	private readonly logOutUseCase = inject(LogOutUseCase);
	private readonly router = inject(Router);

	private hasLoadedTraining = false;

	constructor() {
		// The session settles after the first paint, so the training is asked for whenever
		// that happens to land — and only once, however many times the store then changes.
		effect(() => {
			if (this.session.isAuthenticated() && !this.hasLoadedTraining) {
				this.hasLoadedTraining = true;

				void this.training.load();
				void this.activity.load(activityRangeDays(MAX_ACTIVITY_MONTHS));
			}
		});
	}

	openTraining(): void {
		void this.router.navigate([this.trainingLink()]);
	}

	onDayFocus(day: ActivityCell | null): void {
		this.hoveredDay.set(day);
	}

	selectActivityRange(months: number): void {
		this.hoveredDay.set(null);
		this.activityMonths.set(months);
	}

	logOut(): void {
		void this.logOutUseCase.execute();
	}

	retryConnection(): void {
		void this.session.retry();
	}
}

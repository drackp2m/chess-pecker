import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';

import { ActivityHeatmapComponent } from '@app/component/activity-heatmap/activity-heatmap.component';
import type { TranslationRef } from '@app/definition/i18n.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n, i18nRef, provideI18nScope } from '@app/i18n';
import { toProgramSummary } from '@app/page/dashboard/program-summary';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { ActivityStore } from '@app/store/activity.store';
import { SessionStore } from '@app/store/session.store';
import { TrainingStore } from '@app/store/training.store';
import { activityRangeDays, filterActivityDays } from '@app/util/activity-grid';

const ACTIVITY_RANGES = [1, 2, 3, 6, 9, 12] as const;
const DEFAULT_ACTIVITY_MONTHS = 6;

@Component({
	templateUrl: './dashboard.page.html',
	styleUrl: './dashboard.page.scss',
	imports: [ButtonDirective, RouterLinkDirective, I18nPipe, ActivityHeatmapComponent],
	providers: [provideI18nScope('dashboard')],
})
export class DashboardPage {
	protected readonly I18n = I18n;

	readonly session = inject(SessionStore);
	readonly training = inject(TrainingStore);
	readonly activity = inject(ActivityStore);

	readonly summary = computed(() => toProgramSummary(this.training.progress()));

	readonly hoveredDay = signal<TrainingActivityDay | null>(null);

	readonly activityRanges = ACTIVITY_RANGES;
	readonly activityMonths = signal<number>(DEFAULT_ACTIVITY_MONTHS);

	readonly activityDays = computed(() => activityRangeDays(this.activityMonths()));

	readonly visibleActivity = computed(() =>
		filterActivityDays(this.activity.days(), this.activityDays()),
	);

	readonly totalActivity = computed(() =>
		this.visibleActivity().reduce((total, day) => total + day.count, 0),
	);

	/** What the one button on the program does, so the state is read before it is opened. */
	readonly programLabel = computed<TranslationRef>(() => {
		const runningCycle = this.training.runningCycle();

		if ('calibrating' === this.training.active()?.status) {
			return i18nRef(I18n.dashboard.PROGRAM_REFINE);
		}

		return undefined === runningCycle
			? i18nRef(I18n.dashboard.PROGRAM_START)
			: i18nRef(I18n.dashboard.PROGRAM_CONTINUE, { index: runningCycle.index });
	});

	/** Anything already in progress goes straight to the board; the rest needs the forms. */
	private readonly programLink = computed(() =>
		'calibrating' === this.training.active()?.status || undefined !== this.training.runningCycle()
			? '/training/solve'
			: '/training',
	);

	private readonly router = inject(Router);

	private hasLoadedProgram = false;

	constructor() {
		// The session settles after the first paint, so the program is asked for whenever
		// that happens to land — and only once, however many times the store then changes.
		effect(() => {
			if (this.session.isAuthenticated() && !this.hasLoadedProgram) {
				this.hasLoadedProgram = true;

				void this.training.load();
				void this.activity.load();
			}
		});
	}

	openProgram(): void {
		void this.router.navigate([this.programLink()]);
	}

	onDayFocus(day: TrainingActivityDay | null): void {
		this.hoveredDay.set(day);
	}

	selectActivityRange(months: number): void {
		this.hoveredDay.set(null);
		this.activityMonths.set(months);
	}

	logOut(): void {
		void this.session.logOut();
	}

	retryConnection(): void {
		void this.session.retry();
	}
}

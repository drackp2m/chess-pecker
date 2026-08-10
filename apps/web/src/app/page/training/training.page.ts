import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
	CycleProgress,
	Training,
	TrainingActivityDay,
	TrainingStatus,
} from '@chesspecker/api-definitions';

import { ActivityChartComponent } from '@app/component/activity-chart/activity-chart.component';
import type { ChartLineStyle, ChartPoint } from '@app/component/activity-chart/chart-geometry';
import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { I18nService } from '@app/service/i18n.service';
import { ActivityStore } from '@app/store/activity.store';
import { TrainingStore } from '@app/store/training.store';
import { activityDaySeries } from '@app/util/activity-grid';

const DAILY_RANGE_DAYS = 45;
const DEFAULT_SET_SIZE = 1000;
const DEFAULT_PUZZLES_PER_DAY = 20;
const MAX_SET_SIZE = 5000;
const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1000;

const PHASE_LABEL = {
	calibrating: I18n.training.PHASE_CALIBRATING,
	planning: I18n.training.PHASE_PLANNING,
	running: I18n.training.PHASE_RUNNING,
	finished: I18n.training.PHASE_FINISHED,
	abandoned: I18n.training.PHASE_ABANDONED,
} as const satisfies Record<TrainingStatus, string>;

const STATUS_LABEL = {
	calibrating: I18n.training.STATUS_CALIBRATING,
	planning: I18n.training.STATUS_PLANNING,
	running: I18n.training.STATUS_RUNNING,
	finished: I18n.training.STATUS_FINISHED,
	abandoned: I18n.training.STATUS_ABANDONED,
} as const satisfies Record<TrainingStatus, string>;

const CYCLE_STATUS_LABEL = {
	running: I18n.common.RUNNING,
	finished: I18n.common.FINISHED,
	abandoned: I18n.common.CANCELLED,
} as const satisfies Record<CycleProgress['status'], string>;

@Component({
	templateUrl: './training.page.html',
	styleUrl: './training.page.scss',
	imports: [
		ReactiveFormsModule,
		InputDirective,
		ButtonDirective,
		RouterLinkDirective,
		I18nPipe,
		ActivityChartComponent,
	],
})
export class TrainingPage implements OnInit {
	protected readonly I18n = I18n;

	readonly store = inject(TrainingStore);

	private readonly activity = inject(ActivityStore);
	private readonly i18n = inject(I18nService);

	readonly phaseLabel = computed(() => {
		const status = this.store.active()?.status;

		return undefined === status ? '' : PHASE_LABEL[status];
	});

	readonly hoveredDay = signal<ChartPoint | null>(null);

	private readonly dailyBreakdown = computed(() =>
		activityDaySeries(this.activity.days(), DAILY_RANGE_DAYS),
	);

	readonly dailyPoints = computed<readonly ChartPoint[]>(() =>
		this.dailyBreakdown().map((day) => this.toChartPoint(day)),
	);

	readonly dailySolved = computed(() =>
		this.dailyBreakdown().reduce((total, day) => total + day.solved, 0),
	);

	readonly dailyBarLabels = computed<readonly string[]>(() => [
		this.i18n.translate(I18n.training.DAILY_SERIES_SOLVED),
		this.i18n.translate(I18n.training.DAILY_SERIES_FAILED),
		this.i18n.translate(I18n.training.DAILY_SERIES_RESIGNED),
	]);

	readonly dailyLineLabels = computed<readonly string[]>(() => [
		this.i18n.translate(I18n.training.DAILY_SERIES_MISTAKES),
		this.i18n.translate(I18n.training.DAILY_SERIES_HINTS),
	]);

	readonly dailyLineStyles: readonly ChartLineStyle[] = [
		{ curve: 'smooth' },
		{ curve: 'smooth', dash: '3 3' },
	];

	readonly setForm = new FormGroup({
		size: new FormControl(DEFAULT_SET_SIZE, {
			nonNullable: true,
			validators: [Validators.required, Validators.min(1), Validators.max(MAX_SET_SIZE)],
		}),
	});

	// ToDo => the goal only offers exercises per day. `SetTrainingGoalRequestDto` also
	// takes an `endDate`, which is the other half of the question the method asks ("how
	// long do you want the first pass to take"), and it is missing here because
	// `InputDirective` has no date type yet.
	readonly goalForm = new FormGroup({
		puzzlesPerDay: new FormControl(DEFAULT_PUZZLES_PER_DAY, {
			nonNullable: true,
			validators: [Validators.required, Validators.min(1)],
		}),
	});

	ngOnInit(): void {
		this.store.clearError();
		void this.store.load();
		void this.activity.load();
	}

	start(): void {
		void this.store.start();
	}

	selectSet(): void {
		if (this.setForm.valid) {
			void this.store.selectSet(this.setForm.getRawValue().size);
		}
	}

	saveGoal(): void {
		if (this.goalForm.valid) {
			void this.store.setGoal({ puzzlesPerDay: this.goalForm.getRawValue().puzzlesPerDay });
		}
	}

	startCycle(): void {
		void this.store.startCycle();
	}

	finish(): void {
		void this.store.finish();
	}

	cancel(): void {
		void this.store.cancel();
	}

	onDailyFocus(point: ChartPoint | null): void {
		this.hoveredDay.set(point);
	}

	/** Cycle times are read side by side, so minutes and seconds beat raw milliseconds. */
	formatDuration(milliseconds: number | null): string {
		if (null === milliseconds || 0 === milliseconds) {
			return '—';
		}

		const minutes = Math.floor(milliseconds / MS_PER_MINUTE);
		const seconds = Math.round((milliseconds % MS_PER_MINUTE) / MS_PER_SECOND);

		return `${minutes.toString()}m ${seconds.toString().padStart(2, '0')}s`;
	}

	trainingStatus(training: Training): string {
		return STATUS_LABEL[training.status];
	}

	cycleStatus(cycle: CycleProgress): string {
		return this.i18n.translate(CYCLE_STATUS_LABEL[cycle.status]);
	}

	formatAccuracy(accuracy: number): string {
		return `${Math.round(accuracy * 100).toString()}%`;
	}

	describeCycle(cycle: CycleProgress): string {
		return `${cycle.attempted.toString()} / ${cycle.total.toString()} · ${this.formatAccuracy(
			cycle.accuracy,
		)}`;
	}

	private toChartPoint(day: TrainingActivityDay): ChartPoint {
		return {
			key: day.date,
			label: Number(day.date.slice(8)).toString(),
			description: this.i18n.translate(I18n.training.DAILY_DAY_DETAIL, {
				date: day.date,
				solved: day.solved,
				failed: day.failed,
				resigned: day.resigned,
				mistakes: day.mistakes,
				hints: day.hints,
				minutes: Math.round(day.durationMs / MS_PER_MINUTE),
			}),
			stack: [day.resigned, day.failed, day.solved],
			lines: [day.mistakes, day.hints],
		};
	}
}

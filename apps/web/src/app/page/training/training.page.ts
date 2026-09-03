import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { CycleProgress, TrainingStatus } from '@chesspecker/api-definitions';
import { firstValueFrom } from 'rxjs';

import { ActivityChartComponent } from '@app/component/activity-chart/activity-chart.component';
import type { ChartConfig } from '@app/component/activity-chart/chart-config';
import type { ChartData, ChartPoint } from '@app/component/activity-chart/chart-data';
import { CancelTrainingModalComponent } from '@app/component/cancel-training-modal/cancel-training-modal.component';
import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { toTrainingSummary } from '@app/page/dashboard/training-summary';
import { DurationPipe } from '@app/pipe/duration.pipe';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { TrainingRow } from '@app/repository/definition/training-schema.interface';
import { I18nService } from '@app/service/i18n.service';
import { TimezoneService } from '@app/service/timezone.service';
import { ActivityStore } from '@app/store/activity.store';
import { ModalStore } from '@app/store/modal.store';
import { TrainingStore } from '@app/store/training.store';
import { CyclePaceDay, cyclePaceSeries } from '@app/util/activity-grid';
import { diffLabelDays, zoneDayLabel } from '@app/util/timezone-date';

const DAILY_RANGE_DAYS = 14;
const DEFAULT_SET_SIZE = 1000;
const DEFAULT_PUZZLES_PER_DAY = 20;
const MAX_SET_SIZE = 5000;

const PHASE_LABEL = {
	calibrating: I18n.training.PHASE_CALIBRATING,
	planning: I18n.training.PHASE_PLANNING,
	running: I18n.training.PHASE_RUNNING,
	finished: I18n.training.PHASE_FINISHED,
	cancelled: I18n.training.PHASE_CANCELLED,
} as const satisfies Record<TrainingStatus, string>;

const STATUS_LABEL = {
	calibrating: I18n.training.STATUS_CALIBRATING,
	planning: I18n.training.STATUS_PLANNING,
	running: I18n.training.STATUS_RUNNING,
	finished: I18n.training.STATUS_FINISHED,
	cancelled: I18n.training.STATUS_CANCELLED,
} as const satisfies Record<TrainingStatus, string>;

const CYCLE_STATUS_LABEL = {
	running: I18n.common.RUNNING,
	finished: I18n.common.FINISHED,
	cancelled: I18n.common.CANCELLED,
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
		DurationPipe,
		ActivityChartComponent,
	],
	providers: [provideI18nScope('training', 'dashboard')],
})
export class TrainingPage implements OnInit {
	protected readonly I18n = I18n;

	readonly store = inject(TrainingStore);

	private readonly activity = inject(ActivityStore);
	private readonly i18n = inject(I18nService);
	private readonly modalStore = inject(ModalStore);
	private readonly timezoneService = inject(TimezoneService);

	readonly phaseLabel = computed(() => {
		const status = this.store.active()?.status;

		return undefined === status ? '' : PHASE_LABEL[status];
	});

	readonly summary = computed(() => toTrainingSummary(this.store.progress()));

	readonly hoveredPaceDay = signal<ChartPoint | null>(null);

	readonly cyclePaceDays = computed<readonly CyclePaceDay[]>(() => {
		const cycle = this.store.runningCycle();
		const pace = this.store.progress()?.goal?.puzzlesPerDay ?? null;

		return undefined === cycle || null === pace
			? []
			: cyclePaceSeries(
					this.activity.days(),
					cycle.startedAt,
					pace,
					this.timezoneService.selectedTimezone(),
				);
	});

	readonly cyclePaceChart = computed<ChartData>(() => {
		const days = [...this.cyclePaceDays()].reverse();

		return {
			points: days.map((day) => this.toPacePoint(day)),
			series: [
				{
					id: 'delta',
					label: this.i18n.translate(I18n.training.CYCLE_PACE_SERIES_DELTA),
					values: days.map((day) => day.delta),
				},
				{
					id: 'drift',
					type: 'line',
					label: this.i18n.translate(I18n.training.CYCLE_PACE_SERIES_DRIFT),
					values: days.map((day) => day.drift),
					line: { curve: 'smooth' },
				},
			],
		};
	});

	readonly cyclePaceConfig: ChartConfig = {
		layout: { direction: 'rtl', height: 90 },
		bars: { count: 14, pad: true, grow: 'bar' },
		overflow: { mode: 'drop' },
		axes: { mode: 'none', shared: false },
		labels: { show: false },
	};

	readonly cyclePace = computed(() => this.store.progress()?.goal?.puzzlesPerDay ?? 0);

	readonly cyclePaceDrift = computed(() => this.cyclePaceDays().at(-1)?.drift ?? 0);

	readonly setForm = new FormGroup({
		size: new FormControl(DEFAULT_SET_SIZE, {
			nonNullable: true,
			validators: [Validators.required, Validators.min(1), Validators.max(MAX_SET_SIZE)],
		}),
	});

	// ToDo => the goal only offers exercises per day; `SetTrainingGoalRequestDto` also takes
	// an `endDate`, missing here because `InputDirective` has no date type yet.
	readonly paceForm = new FormGroup({
		puzzlesPerDay: new FormControl(DEFAULT_PUZZLES_PER_DAY, {
			nonNullable: true,
			validators: [Validators.required, Validators.min(1)],
		}),
	});

	ngOnInit(): void {
		this.store.clearError();
		void this.loadTraining();
	}

	start(): void {
		void this.store.start();
	}

	selectSet(): void {
		if (this.setForm.valid) {
			void this.store.selectSet(this.setForm.getRawValue().size);
		}
	}

	savePace(): void {
		if (this.paceForm.valid) {
			void this.store.setGoal({ puzzlesPerDay: this.paceForm.getRawValue().puzzlesPerDay });
		}
	}

	startCycle(): void {
		void this.store.startCycle();
	}

	repairCycle(cycle: CycleProgress): void {
		void this.store.repairCycle(cycle.uuid);
	}

	finish(): void {
		void this.store.finish();
	}

	async cancel(): Promise<void> {
		const modal = await this.modalStore.open(CancelTrainingModalComponent);
		const confirmed = await firstValueFrom(modal.instance.onClose$);

		if (confirmed) {
			void this.store.cancel();
		}
	}

	onPaceFocus(point: ChartPoint | null): void {
		this.hoveredPaceDay.set(point);
	}

	trainingStatus(training: TrainingRow): string {
		return STATUS_LABEL[training.status];
	}

	cycleStatus(cycle: CycleProgress): string {
		return this.i18n.translate(CYCLE_STATUS_LABEL[cycle.status]);
	}

	formatAccuracy(accuracy: number): string {
		return `${Math.round(accuracy * 100).toString()}%`;
	}

	describeCycle(cycle: CycleProgress): string {
		return this.i18n.translate(I18n.training.CYCLE_SUMMARY, {
			done: cycle.attempted,
			total: cycle.total,
			percent: Math.round(cycle.accuracy * 100),
		});
	}

	/**
	 * The training goes first because it decides how much activity is needed: a cycle day that
	 * never arrives counts as zero and drags the trend down.
	 */
	private async loadTraining(): Promise<void> {
		await this.store.load();
		await this.activity.load(this.activityRangeDays());
	}

	private activityRangeDays(): number {
		const startedAt = this.store.runningCycle()?.startedAt;

		if (undefined === startedAt) {
			return DAILY_RANGE_DAYS;
		}

		const timeZone = this.timezoneService.selectedTimezone();
		const started = zoneDayLabel(new Date(startedAt), timeZone);
		const today = zoneDayLabel(new Date(), timeZone);

		return Math.max(DAILY_RANGE_DAYS, diffLabelDays(started, today) + 1);
	}

	private toPacePoint(day: CyclePaceDay): ChartPoint {
		return {
			key: day.date,
			label: Number(day.date.slice(8)).toString(),
			description: this.i18n.translate(I18n.training.CYCLE_PACE_DAY_DETAIL, {
				date: day.date,
				done: day.done,
				expected: day.expected,
				delta: signed(day.delta),
				drift: signed(day.drift),
			}),
		};
	}
}

const signed = (value: number): string => (0 > value ? value.toString() : `+${value.toString()}`);

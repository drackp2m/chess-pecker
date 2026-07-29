import { Component, OnInit, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CycleProgress, TrainingStatus } from '@app/definition/training.interface';
import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { TrainingStore } from '@app/store/training.store';

const DEFAULT_SET_SIZE = 1000;
const DEFAULT_PUZZLES_PER_DAY = 20;
const MAX_SET_SIZE = 5000;
const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1000;

const PHASE_LABEL: Record<TrainingStatus, string> = {
	calibrating: 'Finding your level',
	planning: 'Choosing the set and the pace',
	running: 'Running the cycles',
	finished: 'Finished',
	abandoned: 'Cancelled',
};

@Component({
	templateUrl: './training.page.html',
	styleUrl: './training.page.scss',
	imports: [ReactiveFormsModule, InputDirective, ButtonDirective, RouterLinkDirective],
})
export class TrainingPage implements OnInit {
	readonly store = inject(TrainingStore);

	readonly phaseLabel = computed(() => {
		const status = this.store.active()?.status;

		return undefined === status ? '' : PHASE_LABEL[status];
	});

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

	/** Cycle times are read side by side, so minutes and seconds beat raw milliseconds. */
	formatDuration(milliseconds: number | null): string {
		if (null === milliseconds || 0 === milliseconds) {
			return '—';
		}

		const minutes = Math.floor(milliseconds / MS_PER_MINUTE);
		const seconds = Math.round((milliseconds % MS_PER_MINUTE) / MS_PER_SECOND);

		return `${minutes.toString()}m ${seconds.toString().padStart(2, '0')}s`;
	}

	formatAccuracy(accuracy: number): string {
		return `${Math.round(accuracy * 100).toString()}%`;
	}

	describeCycle(cycle: CycleProgress): string {
		return `${cycle.attempted.toString()} / ${cycle.total.toString()} · ${this.formatAccuracy(
			cycle.accuracy,
		)}`;
	}
}

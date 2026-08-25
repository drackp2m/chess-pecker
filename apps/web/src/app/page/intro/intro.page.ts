import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { StepIndicatorComponent } from '@app/component/step-indicator/step-indicator.component';
import { INTRO_STEPS, IntroStep } from '@app/definition/intro-step.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { IntroStore } from '@app/store/intro.store';
import { TrainingStore } from '@app/store/training.store';
import { ScheduledAction } from '@app/util/scheduled-action';

type StepPhase = 'entering' | 'idle' | 'leaving';

const LEAVE_DURATION_MS = 160;

const ENTER_DURATION_MS = 200;

@Component({
	templateUrl: './intro.page.html',
	styleUrl: './intro.page.scss',
	imports: [StepIndicatorComponent, ButtonDirective, I18nPipe],
	providers: [provideI18nScope('intro')],
})
export class IntroPage {
	protected readonly I18n = I18n;

	readonly intro = inject(IntroStore);
	readonly training = inject(TrainingStore);

	readonly leaveLabel = computed(() =>
		this.intro.isRevisit() ? I18n.intro.CLOSE : I18n.intro.SKIP,
	);

	readonly forwardLabel = computed(() => {
		if (!this.intro.isLast()) {
			return I18n.intro.NEXT;
		}

		return this.intro.isRevisit() ? I18n.intro.CLOSE : I18n.intro.START;
	});

	readonly phase = signal<StepPhase>('idle');
	readonly direction = signal(1);
	readonly visibleStep = signal<IntroStep>(INTRO_STEPS[0]);

	private readonly router = inject(Router);

	private readonly leaving = new ScheduledAction();
	private readonly entering = new ScheduledAction();

	constructor() {
		this.intro.enter();
		this.visibleStep.set(this.intro.step());

		this.watchStep();

		inject(DestroyRef).onDestroy(() => {
			this.leaving.cancel();
			this.entering.cancel();
		});
	}

	forward(): void {
		if (!this.intro.isLast()) {
			this.intro.next();

			return;
		}

		if (this.intro.isRevisit()) {
			this.leave();

			return;
		}

		void this.begin();
	}

	leave(): void {
		this.intro.complete();

		void this.router.navigate(['/']);
	}

	private async begin(): Promise<void> {
		this.intro.complete();

		await this.training.load();

		if (null === this.training.active()) {
			await this.training.start();
		}

		void this.router.navigate([this.training.canSolve() ? '/training/solve' : '/training']);
	}

	private watchStep(): void {
		let previous = this.intro.index();

		effect(() => {
			const index = this.intro.index();

			if (index !== previous) {
				const isForward = index > previous;
				previous = index;

				this.swapStep(this.intro.step(), isForward);
			}
		});
	}

	private swapStep(step: IntroStep, isForward: boolean): void {
		this.entering.cancel();
		this.direction.set(isForward ? 1 : -1);
		this.phase.set('leaving');

		this.leaving.run(() => {
			this.visibleStep.set(step);
			this.phase.set('entering');

			this.entering.run(() => {
				this.phase.set('idle');
			}, ENTER_DURATION_MS);
		}, LEAVE_DURATION_MS);
	}
}

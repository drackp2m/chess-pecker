import { Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { SessionStore } from '@app/store/session.store';
import { TrainingStore } from '@app/store/training.store';

@Component({
	templateUrl: './dashboard.page.html',
	styleUrl: './dashboard.page.scss',
	imports: [ButtonDirective, RouterLinkDirective],
})
export class DashboardPage {
	readonly session = inject(SessionStore);
	readonly training = inject(TrainingStore);

	/** What the one button on the program does, so the state is read before it is opened. */
	readonly programLabel = computed(() => {
		const runningCycle = this.training.runningCycle();

		if ('calibrating' === this.training.active()?.status) {
			return 'Refine the calibration';
		}

		return undefined === runningCycle
			? 'Start a new block of exercises'
			: `Continue cycle ${runningCycle.index.toString()}`;
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
			}
		});
	}

	openProgram(): void {
		void this.router.navigate([this.programLink()]);
	}

	logOut(): void {
		void this.session.logOut();
	}
}

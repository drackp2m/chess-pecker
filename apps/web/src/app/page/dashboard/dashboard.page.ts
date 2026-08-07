import { Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';

import type { TranslationRef } from '@app/definition/i18n.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n } from '@app/i18n';
import { toProgramSummary } from '@app/page/dashboard/program-summary';
import { SessionStore } from '@app/store/session.store';
import { TrainingStore } from '@app/store/training.store';

@Component({
	templateUrl: './dashboard.page.html',
	styleUrl: './dashboard.page.scss',
	imports: [ButtonDirective, RouterLinkDirective, TranslocoPipe],
	providers: [provideTranslocoScope('dashboard')],
})
export class DashboardPage {
	protected readonly I18n = I18n;

	readonly session = inject(SessionStore);
	readonly training = inject(TrainingStore);

	readonly summary = computed(() => toProgramSummary(this.training.progress()));

	/** What the one button on the program does, so the state is read before it is opened. */
	readonly programLabel = computed<TranslationRef>(() => {
		const runningCycle = this.training.runningCycle();

		if ('calibrating' === this.training.active()?.status) {
			return { key: I18n.dashboard.PROGRAM_REFINE };
		}

		return undefined === runningCycle
			? { key: I18n.dashboard.PROGRAM_START }
			: { key: I18n.dashboard.PROGRAM_CONTINUE, params: { index: runningCycle.index } };
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

	retryConnection(): void {
		void this.session.retry();
	}
}

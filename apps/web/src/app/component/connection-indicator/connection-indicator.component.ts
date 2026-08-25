import { Component, computed, inject } from '@angular/core';

import { ButtonDirective } from '@app/directive/button.directive';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { SessionStore } from '@app/store/session.store';

/**
 * Only what the sync icon beside it cannot say: a call long enough to look broken, and a
 * server that never answered. The long version lives on the dashboard.
 */
const PHASE_MESSAGES = {
	idle: null,
	connecting: null,
	waking: I18n.common.WAKING,
	unreachable: I18n.common.NO_CONNECTION,
} as const;

const PHASE_DETAILS = {
	idle: '',
	connecting: '',
	waking: I18n.common.WAKING_DETAIL,
	unreachable: I18n.common.NO_CONNECTION_DETAIL,
} as const;

@Component({
	selector: 'app-connection-indicator',
	templateUrl: './connection-indicator.component.html',
	styleUrl: './connection-indicator.component.scss',
	imports: [ButtonDirective, I18nPipe],
})
export class ConnectionIndicatorComponent {
	protected readonly I18n = I18n;

	private readonly sessionStore = inject(SessionStore);

	readonly phase = this.sessionStore.connectionPhase;

	readonly message = computed(() => PHASE_MESSAGES[this.phase()]);
	readonly detail = computed(() => PHASE_DETAILS[this.phase()]);
	readonly canRetry = computed(() => 'unreachable' === this.phase());

	retry(): void {
		void this.sessionStore.retry();
	}
}

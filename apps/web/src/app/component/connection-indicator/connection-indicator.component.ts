import { Component, computed, inject } from '@angular/core';

import { ButtonDirective } from '@app/directive/button.directive';
import { SessionStore } from '@app/store/session.store';

/**
 * Short in the header, where there is no room, and the whole sentence in the title so the
 * explanation is one hover away. The long version of all this lives on the dashboard.
 */
const PHASE_MESSAGES = {
	idle: null,
	connecting: 'Connecting…',
	waking: 'Waking the server up…',
	unreachable: 'No connection',
} as const;

const PHASE_DETAILS = {
	idle: '',
	connecting: 'Talking to the server.',
	waking: 'The server was asleep. Waking it up takes up to a minute.',
	unreachable: 'The server did not answer. The board, free play and your settings still work.',
} as const;

@Component({
	selector: 'app-connection-indicator',
	templateUrl: './connection-indicator.component.html',
	styleUrl: './connection-indicator.component.scss',
	imports: [ButtonDirective],
})
export class ConnectionIndicatorComponent {
	private readonly sessionStore = inject(SessionStore);

	readonly phase = this.sessionStore.connectionPhase;
	readonly message = computed(() => PHASE_MESSAGES[this.phase()]);
	readonly detail = computed(() => PHASE_DETAILS[this.phase()]);
	readonly canRetry = this.sessionStore.isUnreachable;

	retry(): void {
		void this.sessionStore.retry();
	}
}

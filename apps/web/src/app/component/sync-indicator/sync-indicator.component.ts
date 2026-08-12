import { Component, computed, inject } from '@angular/core';

import { SvgComponent } from '@app/component/svg/svg.component';
import type { ConnectionPhase } from '@app/definition/session-status.type';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { ApiSdkService } from '@app/service/api-sdk.service';
import { SessionStore } from '@app/store/session.store';

const PHASE_DETAILS: Record<ConnectionPhase, string> = {
	idle: '',
	connecting: I18n.common.CONNECTING_DETAIL,
	waking: I18n.common.WAKING_DETAIL,
	unreachable: I18n.common.NO_CONNECTION_DETAIL,
};

@Component({
	selector: 'app-sync-indicator',
	templateUrl: './sync-indicator.component.html',
	styleUrl: './sync-indicator.component.scss',
	imports: [SvgComponent, I18nPipe],
})
export class SyncIndicatorComponent {
	private readonly apiSdk = inject(ApiSdkService);

	private readonly phase = inject(SessionStore).connectionPhase;

	protected readonly isOffline = computed(() => 'unreachable' === this.phase());

	protected readonly showUp = computed(() => !this.isOffline() && this.apiSdk.isSaving());
	protected readonly showDown = computed(() => !this.isOffline() && this.apiSdk.isFetching());

	protected readonly isVisible = computed(
		() => 'idle' !== this.phase() || this.showUp() || this.showDown(),
	);

	protected readonly icon = computed(() => (this.isOffline() ? 'cloud-slash' : 'cloud'));
	protected readonly detail = computed(() => PHASE_DETAILS[this.phase()]);

	protected readonly label = computed(() => {
		if (this.isOffline()) {
			return I18n.common.NO_CONNECTION;
		}

		if ('waking' === this.phase()) {
			return I18n.common.WAKING;
		}

		if (this.showUp()) {
			return I18n.common.SAVING;
		}

		if (this.showDown()) {
			return I18n.common.LOADING;
		}

		return 'connecting' === this.phase() ? I18n.common.CONNECTING : '';
	});
}

import { Component, computed, inject } from '@angular/core';

import { ConnectionIndicatorComponent } from '@app/component/connection-indicator/connection-indicator.component';
import { SyncIndicatorComponent } from '@app/component/sync-indicator/sync-indicator.component';
import type { ConnectionPhase } from '@app/definition/session-status.type';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { TitleService } from '@app/service/title.service';
import { SessionStore } from '@app/store/session.store';

const NOTICE_PHASES = new Set<ConnectionPhase>(['unreachable', 'waking']);

@Component({
	selector: 'app-header',
	templateUrl: './header.component.html',
	styleUrl: './header.component.scss',
	imports: [RouterLinkDirective, SyncIndicatorComponent, ConnectionIndicatorComponent, I18nPipe],
})
export class HeaderComponent {
	protected readonly I18n = I18n;

	readonly session = inject(SessionStore);

	private readonly titleService = inject(TitleService);

	readonly titleKey = this.titleService.titleKey;

	readonly hasNotice = computed(() => NOTICE_PHASES.has(this.session.connectionPhase()));
}

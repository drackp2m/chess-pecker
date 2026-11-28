import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ConnectionIndicatorComponent } from '@app/component/connection-indicator/connection-indicator.component';
import { SvgComponent } from '@app/component/svg/svg.component';
import { SyncIndicatorComponent } from '@app/component/sync-indicator/sync-indicator.component';
import type { ConnectionPhase } from '@app/definition/session-status.type';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { HeaderService } from '@app/service/header.service';
import { SessionStore } from '@app/store/session.store';

const NOTICE_PHASES = new Set<ConnectionPhase>(['unreachable', 'waking']);

@Component({
	selector: 'app-header',
	templateUrl: './header.component.html',
	styleUrl: './header.component.scss',
	imports: [SvgComponent, SyncIndicatorComponent, ConnectionIndicatorComponent, I18nPipe],
})
export class HeaderComponent {
	protected readonly I18n = I18n;

	private readonly router = inject(Router);
	private readonly session = inject(SessionStore);
	private readonly headerService = inject(HeaderService);

	readonly titleKey = this.headerService.titleKey;

	readonly backLink = this.headerService.backLink;

	readonly hasNotice = computed(() => NOTICE_PHASES.has(this.session.connectionPhase()));

	goBack(link: string) {
		void this.router.navigateByUrl(link);
	}
}

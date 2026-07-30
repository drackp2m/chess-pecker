import { Component, inject } from '@angular/core';

import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { SessionStore } from '@app/store/session.store';

@Component({
	templateUrl: './dashboard.page.html',
	styleUrl: './dashboard.page.scss',
	imports: [ButtonDirective, RouterLinkDirective],
})
export class DashboardPage {
	readonly session = inject(SessionStore);

	logOut(): void {
		void this.session.logOut();
	}
}

import { Component, inject } from '@angular/core';

import { ConnectionIndicatorComponent } from '@app/component/connection-indicator/connection-indicator.component';
import { SaveIndicatorComponent } from '@app/component/save-indicator/save-indicator.component';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { TitleService } from '@app/service/title.service';
import { SessionStore } from '@app/store/session.store';

@Component({
	selector: 'app-header',
	templateUrl: './header.component.html',
	styleUrl: './header.component.scss',
	imports: [RouterLinkDirective, SaveIndicatorComponent, ConnectionIndicatorComponent],
})
export class HeaderComponent {
	readonly session = inject(SessionStore);

	private readonly titleService = inject(TitleService);

	readonly title = this.titleService.title;
}

import { Component, inject } from '@angular/core';

import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { TitleService } from '@app/service/title.service';
import { SessionStore } from '@app/store/session.store';

@Component({
	selector: 'app-header',
	templateUrl: './header.component.html',
	styleUrl: './header.component.scss',
	imports: [RouterLinkDirective],
})
export class HeaderComponent {
	readonly session = inject(SessionStore);

	private readonly titleService = inject(TitleService);

	readonly title = this.titleService.title;
}

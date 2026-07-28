import { Component, inject } from '@angular/core';

import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { TitleService } from '@app/service/title.service';

@Component({
	selector: 'app-header',
	templateUrl: './header.component.html',
	styleUrl: './header.component.scss',
	imports: [RouterLinkDirective, ButtonDirective],
})
export class HeaderComponent {
	private readonly titleService = inject(TitleService);

	readonly title = this.titleService.title;
}

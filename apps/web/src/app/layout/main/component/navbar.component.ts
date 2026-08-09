import { Component } from '@angular/core';

import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';

@Component({
	selector: 'app-navbar',
	templateUrl: './navbar.component.html',
	styleUrl: './navbar.component.scss',
	imports: [RouterLinkDirective, I18nPipe],
})
export class NavbarComponent {
	protected readonly I18n = I18n;
}

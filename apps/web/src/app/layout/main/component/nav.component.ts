import { Component } from '@angular/core';

import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';

@Component({
	selector: 'app-nav',
	templateUrl: './nav.component.html',
	styleUrl: './nav.component.scss',
	imports: [RouterLinkDirective, ButtonDirective],
})
export class NavComponent {}

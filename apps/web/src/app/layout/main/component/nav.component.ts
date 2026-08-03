import { Component } from '@angular/core';

import { RouterLinkDirective } from '@app/directive/router-link.directive';

@Component({
	selector: 'app-nav',
	templateUrl: './nav.component.html',
	styleUrl: './nav.component.scss',
	imports: [RouterLinkDirective],
})
export class NavComponent {}

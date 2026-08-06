import { Component } from '@angular/core';

import { RouterLinkDirective } from '@app/directive/router-link.directive';

@Component({
	selector: 'app-navbar',
	templateUrl: './navbar.component.html',
	styleUrl: './navbar.component.scss',
	imports: [RouterLinkDirective],
})
export class NavbarComponent {}

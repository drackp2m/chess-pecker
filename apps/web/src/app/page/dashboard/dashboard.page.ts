import { Component } from '@angular/core';

import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { SelectDirective } from '@app/directive/select/select.directive';

@Component({
	templateUrl: './dashboard.page.html',
	styleUrl: './dashboard.page.scss',
	imports: [ButtonDirective, InputDirective, SelectDirective, RouterLinkDirective],
})
export class DashboardPage {}

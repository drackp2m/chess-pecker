import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ModalOutletComponent } from '@app/component/modal-outlet/modal-outlet.component';
import { NotificationOutletComponent } from '@app/component/notification-outlet/notification-outlet.component';
import { HeaderComponent } from '@app/layout/main/component/header.component';
import { NavComponent } from '@app/layout/main/component/nav.component';

@Component({
	templateUrl: './main.layout.html',
	styleUrl: './main.layout.scss',
	imports: [
		HeaderComponent,
		RouterOutlet,
		NavComponent,
		ModalOutletComponent,
		NotificationOutletComponent,
	],
})
export class MainLayout {}

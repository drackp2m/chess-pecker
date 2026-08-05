import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ModalOutletComponent } from '@app/component/modal-outlet/modal-outlet.component';
import { NotificationOutletComponent } from '@app/component/notification-outlet/notification-outlet.component';
import { HeaderComponent } from '@app/layout/main/component/header.component';
import { NavbarComponent } from '@app/layout/main/component/navbar.component';

@Component({
	templateUrl: './main.layout.html',
	styleUrl: './main.layout.scss',
	imports: [
		HeaderComponent,
		RouterOutlet,
		NavbarComponent,
		ModalOutletComponent,
		NotificationOutletComponent,
	],
})
export class MainLayout {}

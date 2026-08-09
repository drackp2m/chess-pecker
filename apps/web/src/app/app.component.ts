import { Component, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	imports: [RouterOutlet, ReactiveFormsModule, I18nPipe],
	providers: [],
})
export class AppComponent {
	protected readonly I18n = I18n;

	title = 'chesspecker';

	readonly loading = signal(false);
}

import { Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

import { ModalOutletComponent } from '@app/component/modal-outlet/modal-outlet.component';
import { SyncSplashComponent } from '@app/component/sync-splash/sync-splash.component';
import { SyncStore } from '@app/store/sync.store';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	imports: [RouterOutlet, ReactiveFormsModule, ModalOutletComponent, SyncSplashComponent],
	providers: [],
})
export class AppComponent {
	title = 'chesspecker';

	private readonly sync = inject(SyncStore);

	/**
	 * The boot gate, closed only by a download: anything painted over a half-replica would be
	 * wrong. What is left to upload is already here, so it waits for nobody.
	 */
	readonly loading = computed(() => !this.sync.isReady());
}

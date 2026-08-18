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
	 * La puerta de arranque. Hasta que la sincronización termina —con éxito o sin él— no hay
	 * nada que servir: lo que se pintara antes se pintaría con una réplica a medias.
	 */
	readonly loading = computed(() => !this.sync.isReady());
}

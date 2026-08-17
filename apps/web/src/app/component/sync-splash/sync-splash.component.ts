import { Component, OnDestroy, computed, inject, signal } from '@angular/core';

import { SYNC_PHASE_LABEL } from '@app/definition/sync-phase.type';
import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { SyncStore } from '@app/store/sync.store';
import { WatchedDelay } from '@app/util/watched-delay';

/**
 * Lo que se ve mientras la aplicación aún no sirve datos. El detalle sólo sale si hay
 * algo que sincronizar y la espera ha durado lo bastante como para que enseñarlo no sea un
 * parpadeo: el caso normal —nada pendiente y nada nuevo— no debe enseñar nada.
 */
@Component({
	selector: 'app-sync-splash',
	templateUrl: './sync-splash.component.html',
	styleUrl: './sync-splash.component.scss',
	imports: [I18nPipe],
})
export class SyncSplashComponent implements OnDestroy {
	protected readonly I18n = I18n;

	protected readonly sync = inject(SyncStore);

	protected readonly message = computed(() => SYNC_PHASE_LABEL[this.sync.phase()]);

	protected readonly isDownloading = computed(
		() => 'pulling' === this.sync.phase() && 0 < this.sync.behind().length,
	);

	protected readonly isSweeping = computed(
		() => 0 < this.sync.catalogTotal() && this.sync.catalogDone() < this.sync.catalogTotal(),
	);

	protected readonly showDetail = computed(
		() => this.waited() && (this.sync.hasPending() || this.isDownloading() || this.isSweeping()),
	);

	private readonly waited = signal(false);

	// El retardo cuenta sólo el tiempo que la pestaña está a la vista, que es el único que
	// el usuario ha pasado esperando: una pestaña de fondo no está mirando nada.
	private readonly delay = new WatchedDelay();

	constructor() {
		this.delay.start(SyncPolicy.splashDetailMs, () => {
			this.waited.set(true);
		});

		document.addEventListener('visibilitychange', this.onVisibilityChange);
	}

	ngOnDestroy(): void {
		this.delay.cancel();
		document.removeEventListener('visibilitychange', this.onVisibilityChange);
	}

	private readonly onVisibilityChange = (): void => {
		if ('visible' === document.visibilityState) {
			this.delay.resume();
		} else {
			this.delay.pause();
		}
	};
}
